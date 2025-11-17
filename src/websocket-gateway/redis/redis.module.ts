import { Module, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfigService } from './redis-config.service';

/**
 * Redis Module
 *
 * Provides Redis client instance for WebSocket Gateway features:
 * - Distributed locks (BE-001.3)
 * - Presence tracking (BE-001.2)
 * - Pub/Sub for cross-server communication
 *
 * Architecture:
 * - RedisConfigService: Centralized Redis configuration
 * - Redis Provider: Factory that creates ioredis instance
 * - Exports both for injection in other modules
 *
 * Environment Variables (from RedisConfigService):
 * - REDIS_HOST: localhost (default)
 * - REDIS_PORT: 6379 (default)
 * - REDIS_DB: 0 (production), 15 (tests)
 * - REDIS_PASSWORD: optional
 *
 * Usage in other modules:
 * ```typescript
 * @Module({
 *   imports: [RedisModule],
 * })
 * export class WebSocketGatewayModule {}
 * ```
 *
 * Testing with isolated database:
 * ```typescript
 * const redis = new Redis({ db: 15 }); // Test database
 * ```
 */
@Module({
  imports: [ConfigModule],
  providers: [
    RedisConfigService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: RedisConfigService) => {
        const logger = new Logger('RedisModule');
        const config = configService.getRedisConfig();

        logger.log(
          `Connecting to Redis: ${config.host}:${config.port} db=${config.db}`,
        );

        const redis = new Redis({
          host: config.host,
          port: config.port,
          db: config.db,
          password: config.password,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
            return delay;
          },
          reconnectOnError: (err: Error) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
              logger.error('Redis READONLY error, reconnecting...');
              return true; // Reconnect
            }
            return false;
          },
        });

        redis.on('connect', () => {
          logger.log('✓ Redis connected successfully');
        });

        redis.on('ready', () => {
          logger.log('✓ Redis ready to accept commands');
        });

        redis.on('error', (err: Error) => {
          logger.error(`Redis error: ${err.message}`);
        });

        redis.on('close', () => {
          logger.warn('Redis connection closed');
        });

        redis.on('reconnecting', () => {
          logger.log('Redis reconnecting...');
        });

        // Test connection
        try {
          await redis.ping();
          logger.log('✓ Redis PING successful');
        } catch (error) {
          logger.error('Failed to ping Redis', error);
          throw error;
        }

        return redis;
      },
      inject: [RedisConfigService],
    },
  ],
  exports: ['REDIS_CLIENT', RedisConfigService],
})
export class RedisModule {}
