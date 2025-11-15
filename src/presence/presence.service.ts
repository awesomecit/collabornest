import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { CollaborNestConfig, PresenceInfo, PresenceStatus, UserRole } from '../interfaces';

@Injectable()
export class PresenceService {
  private redis: Redis;
  private readonly heartbeatInterval: number;
  private readonly timeout: number;
  private readonly keyPrefix: string;

  constructor(@Inject(COLLABORNEST_CONFIG) private config: CollaborNestConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });
    this.heartbeatInterval = config.presence?.heartbeatInterval || 30000;
    this.timeout = config.presence?.timeout || 60000;
    this.keyPrefix = config.redis.keyPrefix || 'collabornest:';
  }

  async joinResource(
    userId: string,
    resourceId: string,
    role: UserRole,
    metadata?: Record<string, any>,
  ): Promise<PresenceInfo> {
    const presence: PresenceInfo = {
      userId,
      resourceId,
      status: PresenceStatus.ONLINE,
      role,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      metadata,
    };

    const key = `${this.keyPrefix}presence:${resourceId}:${userId}`;
    await this.redis.setex(key, Math.floor(this.timeout / 1000), JSON.stringify(presence));

    // Add to resource users set
    await this.redis.sadd(`${this.keyPrefix}presence:${resourceId}:users`, userId);

    return presence;
  }

  async leaveResource(userId: string, resourceId: string): Promise<void> {
    const key = `${this.keyPrefix}presence:${resourceId}:${userId}`;
    await this.redis.del(key);
    await this.redis.srem(`${this.keyPrefix}presence:${resourceId}:users`, userId);
  }

  async updateHeartbeat(userId: string, resourceId: string): Promise<void> {
    const key = `${this.keyPrefix}presence:${resourceId}:${userId}`;
    const data = await this.redis.get(key);

    if (data) {
      const presence: PresenceInfo = JSON.parse(data);
      presence.lastHeartbeat = new Date();
      presence.status = PresenceStatus.ONLINE;

      await this.redis.setex(key, Math.floor(this.timeout / 1000), JSON.stringify(presence));
    }
  }

  async getPresence(userId: string, resourceId: string): Promise<PresenceInfo | null> {
    const key = `${this.keyPrefix}presence:${resourceId}:${userId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async getResourcePresence(resourceId: string): Promise<PresenceInfo[]> {
    const userIds = await this.redis.smembers(`${this.keyPrefix}presence:${resourceId}:users`);
    const presences: PresenceInfo[] = [];

    for (const userId of userIds) {
      const presence = await this.getPresence(userId, resourceId);
      if (presence) {
        presences.push(presence);
      }
    }

    return presences;
  }

  async updateStatus(userId: string, resourceId: string, status: PresenceStatus): Promise<void> {
    const key = `${this.keyPrefix}presence:${resourceId}:${userId}`;
    const data = await this.redis.get(key);

    if (data) {
      const presence: PresenceInfo = JSON.parse(data);
      presence.status = status;
      await this.redis.setex(key, Math.floor(this.timeout / 1000), JSON.stringify(presence));
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
