import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-backed distributed lock service for BE-001.3
 *
 * Provides exclusive editor locking with TTL and automatic cleanup.
 *
 * @see docs/project/BE-001.3-LOCK-SPECIFICATION.md
 */
@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private redis: Redis | null = null;

  constructor() {
    // Redis connection initialized in onModuleInit
  }

  /**
   * Lifecycle hook: Initialize Redis connection
   */
  async onModuleInit(): Promise<void> {
    // TODO: Implement Redis connection setup
    // Read REDIS_* env vars, create ioredis client
    // Handle connection errors gracefully
  }

  /**
   * Lifecycle hook: Cleanup Redis connection
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  private readonly NOT_IMPLEMENTED_ERROR = 'Not implemented';

  /**
   * Acquire an exclusive lock on a resource
   */
  async acquireLock(
    _resourceId: string,
    _userId: string,
    _ttlMs: number = 5 * 60 * 1000, // 5 minutes default (placeholder - decision needed)
  ): Promise<boolean> {
    // TODO: Implement after Monday meeting decisions
    throw new Error(this.NOT_IMPLEMENTED_ERROR);
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
  async releaseLock(_resourceId: string, _userId: string): Promise<boolean> {
    // TODO: Implement in later scenario
    throw new Error('Not implemented - TDD Red phase');
  }

  /**
   * Renew an existing lock TTL
   */
  async renewLock(
    _resourceId: string,
    _userId: string,
    _ttlMs: number = 5 * 60 * 1000,
  ): Promise<boolean> {
    // TODO: Implement after Monday meeting decisions
    throw new Error(this.NOT_IMPLEMENTED_ERROR);
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
  async getLockHolder(_resourceId: string): Promise<{
    userId: string;
    acquiredAt: number;
    expiresAt: number;
  } | null> {
    // TODO: Implement in later scenario
    throw new Error('Not implemented - TDD Red phase');
  }

  /**
   * Check if a specific user holds a lock
   */
  async hasLock(_resourceId: string, _userId: string): Promise<boolean> {
    // TODO: Implement after Monday meeting decisions
    throw new Error(this.NOT_IMPLEMENTED_ERROR);
  }
}
