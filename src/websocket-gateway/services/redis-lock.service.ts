import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisKeyFactory } from '../constants/redis-keys.enum';
import {
  RedisLockError,
  RedisLockLog,
} from '../constants/redis-lock-messages.enum';
import { LockConfig } from '../constants/redis-config';
import { WebSocketGatewayConfigService } from '../config/gateway-config.service';

/**
 * Redis-backed distributed lock service for BE-001.3
 *
 * Provides exclusive editor locking with TTL and automatic cleanup.
 *
 * @see docs/project/BE-001.3-MEETING-OUTCOME.md
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(`[RedisLock] ${RedisLockService.name}`);
  private redis: Redis | null = null;
  private redisOwned = false; // Track if we created the Redis instance

  /**
   * Constructor with dependency injection
   * @param config - WebSocket Gateway config service (for Redis connection)
   * @param redisInstance - Optional Redis instance (for testing with db=15)
   */
  constructor(
    private readonly config?: WebSocketGatewayConfigService,
    redisInstance?: Redis,
  ) {
    if (redisInstance) {
      this.redis = redisInstance;
      this.redisOwned = false; // Externally provided, don't close in onModuleDestroy
    }
  }

  /**
   * Lifecycle hook: Initialize Redis connection (only if not provided in constructor)
   */
  async onModuleInit(): Promise<void> {
    // Skip if Redis already provided via constructor (testing scenario)
    if (this.redis) {
      this.logger.log(RedisLockLog.REDIS_EXTERNAL);
      return;
    }

    if (!this.config) {
      throw new Error(
        'WebSocketGatewayConfigService not injected. Cannot initialize Redis.',
      );
    }

    try {
      const redisConfig = this.config.getRedisConfig();

      this.redis = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
        password: redisConfig.password,
        retryStrategy: times => Math.min(times * 50, 2000),
      });

      this.redisOwned = true; // We created this instance

      this.redis.on('error', err => {
        this.logger.error('Redis connection error', err);
      });

      this.redis.on('connect', () => {
        this.logger.log(RedisLockLog.REDIS_CONNECTED);
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      this.logger.error('Failed to initialize Redis', error);
      throw error;
    }
  }

  /**
   * Lifecycle hook: Cleanup Redis connection (only if we created it)
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.redisOwned) {
      await this.redis.quit();
    }
  }

  private readonly NOT_IMPLEMENTED_ERROR = 'Not implemented';

  /**
   * Helper: Check if existing lock allows reacquisition by same user
   * @returns true if same user (idempotent reacquire), false if different user, null if no lock/corrupted
   */
  private async checkExistingLock(
    lockKey: string,
    userId: string,
    resourceId: string,
  ): Promise<boolean | null> {
    const existingLock = await this.redis!.get(lockKey);
    if (!existingLock) {
      return null; // No existing lock
    }

    try {
      const lockInfo = JSON.parse(existingLock);
      if (lockInfo.userId === userId) {
        this.logger.debug(
          `${RedisLockLog.LOCK_REACQUIRED}: ${resourceId} by ${userId}`,
        );
        return true; // Same user (idempotent)
      }

      this.logger.debug(
        `${RedisLockLog.LOCK_DENIED}: ${resourceId} held by ${lockInfo.userId}, requested by ${userId}`,
      );
      return false; // Different user
    } catch {
      // Corrupted lock data - delete and allow retry
      this.logger.warn(`${RedisLockError.CORRUPTED_LOCK}: ${lockKey}`);
      await this.redis!.del(lockKey); // Remove corrupted key
      return null; // Allow retry
    }
  }

  /**
   * Helper: Attempt atomic lock acquisition with Redis SET NX
   */
  private async attemptAtomicLock(
    lockKey: string,
    userId: string,
    ttlMs: number,
    resourceId: string,
  ): Promise<boolean> {
    const now = Date.now();
    const lockValue = JSON.stringify({
      userId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
    });

    const result = await this.redis!.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

    if (result === 'OK') {
      this.logger.log(`Lock acquired: ${resourceId} by ${userId}`);
      return true;
    }

    this.logger.debug(
      `Lock acquisition race condition: ${resourceId} by ${userId}`,
    );
    return false;
  }

  /**
   * Acquire an exclusive lock on a resource
   *
   * @param resourceId - Resource identifier (e.g., "document:123:main")
   * @param userId - User requesting lock
   * @param ttlMs - Lock TTL in milliseconds (default: 5 minutes per meeting decision)
   * @returns true if lock acquired, false if held by another user
   *
   * Implementation:
   * - Uses Redis SET NX (atomic - only set if key doesn't exist)
   * - Stores lock metadata: { userId, acquiredAt, expiresAt }
   * - Idempotent: Same user can reacquire lock (returns true)
   * - Meeting Decision 6: TTL = 5 minutes (300s)
   */
  async acquireLock(
    resourceId: string,
    userId: string,
    ttlMs: number = LockConfig.DEFAULT_TTL_MS,
  ): Promise<boolean> {
    if (!this.redis) {
      this.logger.error(RedisLockError.REDIS_NOT_INITIALIZED);
      return false;
    }

    try {
      const lockKey = RedisKeyFactory.lock(resourceId);

      // Check existing lock (idempotency)
      const existingLockCheck = await this.checkExistingLock(
        lockKey,
        userId,
        resourceId,
      );

      if (existingLockCheck === true) {
        // Same user reacquire - update TTL
        const existingLock = await this.redis.get(lockKey);
        const lockInfo = JSON.parse(existingLock!);
        const lockValue = JSON.stringify({
          userId,
          acquiredAt: lockInfo.acquiredAt, // Preserve original
          expiresAt: Date.now() + ttlMs,
        });
        await this.redis.set(lockKey, lockValue, 'PX', ttlMs);
        return true;
      } else if (existingLockCheck === false) {
        return false; // Different user holds lock
      }

      // No existing lock or corrupted - attempt atomic acquisition
      return await this.attemptAtomicLock(lockKey, userId, ttlMs, resourceId);
    } catch (error) {
      this.logger.error(
        `Error acquiring lock for ${resourceId} by ${userId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Release lock held by user
   *
   * @param resourceId - Resource identifier
   * @param userId - User releasing lock (must be lock owner)
   * @returns Lock released successfully (true) or not held by user (false)
   *
   * Implementation notes:
   * - Verify userId matches lock holder before releasing
   * - Use Redis DEL command
   * - Idempotent: releasing non-existent lock returns false
   */
  async releaseLock(resourceId: string, userId: string): Promise<boolean> {
    if (!this.redis) {
      this.logger.error(RedisLockError.REDIS_NOT_INITIALIZED);
      return false;
    }

    try {
      const lockKey = RedisKeyFactory.lock(resourceId);
      const existingLock = await this.redis.get(lockKey);

      if (!existingLock) {
        this.logger.debug(`No lock to release: ${resourceId}`);
        return false;
      }

      const lockInfo = JSON.parse(existingLock);

      if (lockInfo.userId !== userId) {
        this.logger.warn(
          `Release denied: ${resourceId} held by ${lockInfo.userId}, attempted by ${userId}`,
        );
        return false;
      }

      await this.redis.del(lockKey);
      this.logger.log(`Lock released: ${resourceId} by ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error releasing lock for ${resourceId} by ${userId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Renew an existing lock TTL (heartbeat mechanism)
   *
   * @param resourceId - Resource identifier
   * @param userId - User renewing lock (must be lock owner)
   * @param ttlMs - New TTL in milliseconds (default: 5 minutes per meeting decision)
   * @returns true if renewed, false if not held by user
   *
   * Implementation notes:
   * - Verify userId matches lock holder
   * - Preserve original acquiredAt timestamp (only update expiresAt)
   * - Use Redis SET with PX to update TTL
   * - Idempotent: returns false if no lock exists
   * - Meeting Decision 7: Heartbeat interval 60s
   */
  async renewLock(
    resourceId: string,
    userId: string,
    ttlMs: number = LockConfig.DEFAULT_TTL_MS,
  ): Promise<boolean> {
    if (!this.redis) {
      this.logger.error(RedisLockError.REDIS_NOT_INITIALIZED);
      return false;
    }

    try {
      const lockKey = RedisKeyFactory.lock(resourceId);
      const existingLock = await this.redis.get(lockKey);

      if (!existingLock) {
        this.logger.debug(`No lock to renew: ${resourceId}`);
        return false;
      }

      const lockInfo = JSON.parse(existingLock);

      if (lockInfo.userId !== userId) {
        this.logger.warn(
          `Renewal denied: ${resourceId} held by ${lockInfo.userId}, attempted by ${userId}`,
        );
        return false;
      }

      const lockValue = JSON.stringify({
        userId: lockInfo.userId,
        acquiredAt: lockInfo.acquiredAt,
        expiresAt: Date.now() + ttlMs,
      });

      await this.redis.set(lockKey, lockValue, 'PX', ttlMs);
      this.logger.debug(`Lock renewed: ${resourceId} by ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error renewing lock for ${resourceId} by ${userId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Get current lock holder for resource
   *
   * @param resourceId - Resource identifier
   * @returns Lock info (userId, acquiredAt, expiresAt) or null if no lock
   *
   * Implementation notes:
   * - Use Redis GET command
   * - Parse JSON value
   * - Return null if key doesn't exist or expired
   */
  async getLockHolder(resourceId: string): Promise<{
    userId: string;
    acquiredAt: number;
    expiresAt: number;
  } | null> {
    if (!this.redis) {
      this.logger.error(RedisLockError.REDIS_NOT_INITIALIZED);
      return null;
    }

    try {
      const lockKey = RedisKeyFactory.lock(resourceId);
      const lockData = await this.redis.get(lockKey);

      if (!lockData) {
        return null;
      }

      const lockInfo = JSON.parse(lockData);
      return {
        userId: lockInfo.userId,
        acquiredAt: lockInfo.acquiredAt,
        expiresAt: lockInfo.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error getting lock holder for ${resourceId}`, error);
      return null;
    }
  }

  /**
   * Check if a specific user holds a lock
   */
  async hasLock(_resourceId: string, _userId: string): Promise<boolean> {
    // TODO: Implement after Monday meeting decisions
    throw new Error(this.NOT_IMPLEMENTED_ERROR);
  }
}
