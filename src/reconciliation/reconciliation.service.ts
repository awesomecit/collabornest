import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import * as amqp from 'amqplib';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { CollaborNestConfig, ReconciliationEvent, MonitoringMetrics } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReconciliationService {
  private redis: Redis;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly keyPrefix: string;
  private readonly exchange: string;
  private readonly queue: string;

  constructor(@Inject(COLLABORNEST_CONFIG) private config: CollaborNestConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });
    this.keyPrefix = config.redis.keyPrefix || 'collabornest:';
    this.exchange = config.rabbitmq?.exchange || 'collabornest.events';
    this.queue = config.rabbitmq?.queue || 'collabornest.reconciliation';

    if (config.rabbitmq) {
      this.initializeRabbitMQ();
    }
  }

  private async initializeRabbitMQ(): Promise<void> {
    try {
      if (!this.config.rabbitmq) {
        return;
      }

      this.connection = await amqp.connect(this.config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      await this.channel.assertQueue(this.queue, { durable: true });
      await this.channel.bindQueue(this.queue, this.exchange, 'event.*');
    } catch (error) {
      console.error('Failed to initialize RabbitMQ:', error);
    }
  }

  async publishEvent(
    resourceId: string,
    userId: string,
    eventType: string,
    data: any,
  ): Promise<ReconciliationEvent> {
    const event: ReconciliationEvent = {
      eventId: uuidv4(),
      resourceId,
      userId,
      eventType,
      data,
      timestamp: new Date(),
      reconciled: false,
    };

    // Store event in Redis
    const key = `${this.keyPrefix}event:${event.eventId}`;
    await this.redis.set(key, JSON.stringify(event));
    await this.redis.sadd(`${this.keyPrefix}events:${resourceId}`, event.eventId);

    // Publish to RabbitMQ if available
    if (this.channel) {
      const routingKey = `event.${eventType}`;
      this.channel.publish(this.exchange, routingKey, Buffer.from(JSON.stringify(event)), {
        persistent: true,
      });
    }

    return event;
  }

  async getEvents(resourceId: string): Promise<ReconciliationEvent[]> {
    const eventIds = await this.redis.smembers(`${this.keyPrefix}events:${resourceId}`);
    const events: ReconciliationEvent[] = [];

    for (const eventId of eventIds) {
      const key = `${this.keyPrefix}event:${eventId}`;
      const data = await this.redis.get(key);
      if (data) {
        events.push(JSON.parse(data));
      }
    }

    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async markAsReconciled(eventId: string): Promise<void> {
    const key = `${this.keyPrefix}event:${eventId}`;
    const data = await this.redis.get(key);

    if (data) {
      const event: ReconciliationEvent = JSON.parse(data);
      event.reconciled = true;
      await this.redis.set(key, JSON.stringify(event));
    }
  }

  async getUnreconciledEvents(resourceId: string): Promise<ReconciliationEvent[]> {
    const events = await this.getEvents(resourceId);
    return events.filter((e) => !e.reconciled);
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

@Injectable()
export class MonitoringService {
  private redis: Redis;
  private readonly keyPrefix: string;
  private readonly metricsInterval: number;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(@Inject(COLLABORNEST_CONFIG) private config: CollaborNestConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });
    this.keyPrefix = config.redis.keyPrefix || 'collabornest:';
    this.metricsInterval = config.monitoring?.metricsInterval || 60000;

    if (config.monitoring?.enabled) {
      this.startMetricsCollection();
    }
  }

  private startMetricsCollection(): void {
    this.intervalHandle = setInterval(() => {
      this.collectMetrics();
    }, this.metricsInterval);
  }

  async collectMetrics(): Promise<MonitoringMetrics> {
    const resources = await this.redis.smembers(`${this.keyPrefix}resources`);
    const lockKeys = await this.redis.keys(`${this.keyPrefix}lock:*`);
    const presenceKeys = await this.redis.keys(`${this.keyPrefix}presence:*:users`);

    let activeConnections = 0;
    for (const key of presenceKeys) {
      const users = await this.redis.smembers(key);
      activeConnections += users.length;
    }

    const metrics: MonitoringMetrics = {
      totalUsers: activeConnections,
      totalResources: resources.length,
      totalLocks: lockKeys.length,
      activeConnections,
      timestamp: new Date(),
    };

    // Store metrics
    const key = `${this.keyPrefix}metrics:${Date.now()}`;
    await this.redis.setex(key, 86400, JSON.stringify(metrics)); // Keep for 24 hours

    return metrics;
  }

  async getMetrics(): Promise<MonitoringMetrics> {
    return this.collectMetrics();
  }

  async getMetricsHistory(hours: number = 1): Promise<MonitoringMetrics[]> {
    const pattern = `${this.keyPrefix}metrics:*`;
    const keys = await this.redis.keys(pattern);
    const metrics: MonitoringMetrics[] = [];

    const cutoff = Date.now() - hours * 3600000;

    for (const key of keys) {
      const timestamp = parseInt(key.split(':').pop() || '0');
      if (timestamp >= cutoff) {
        const data = await this.redis.get(key);
        if (data) {
          metrics.push(JSON.parse(data));
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async cleanup(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    await this.redis.quit();
  }
}
