import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { CollaborNestConfig, Lock, LockStatus } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LockingService {
  private redis: Redis;
  private readonly defaultTimeout: number;
  private readonly maxTimeout: number;
  private readonly keyPrefix: string;

  constructor(@Inject(COLLABORNEST_CONFIG) private config: CollaborNestConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });
    this.defaultTimeout = config.locking?.defaultTimeout || 300000; // 5 minutes
    this.maxTimeout = config.locking?.maxTimeout || 3600000; // 1 hour
    this.keyPrefix = config.redis.keyPrefix || 'collabornest:';
  }

  async acquireLock(
    resourceId: string,
    userId: string,
    timeout?: number,
    metadata?: Record<string, any>,
  ): Promise<Lock | null> {
    const lockKey = `${this.keyPrefix}lock:${resourceId}`;
    const existingLock = await this.redis.get(lockKey);

    if (existingLock) {
      const lock: Lock = JSON.parse(existingLock);
      // Check if lock is expired
      if (new Date(lock.expiresAt) > new Date()) {
        // Lock is still valid
        return null;
      }
    }

    const lockTimeout = Math.min(timeout || this.defaultTimeout, this.maxTimeout);
    const lock: Lock = {
      lockId: uuidv4(),
      resourceId,
      userId,
      acquiredAt: new Date(),
      expiresAt: new Date(Date.now() + lockTimeout),
      status: LockStatus.LOCKED,
      metadata,
    };

    const ttl = Math.floor(lockTimeout / 1000);
    await this.redis.setex(lockKey, ttl, JSON.stringify(lock));

    return lock;
  }

  async releaseLock(resourceId: string, userId: string): Promise<boolean> {
    const lockKey = `${this.keyPrefix}lock:${resourceId}`;
    const existingLock = await this.redis.get(lockKey);

    if (!existingLock) {
      return false;
    }

    const lock: Lock = JSON.parse(existingLock);

    // Only the lock owner can release it
    if (lock.userId !== userId) {
      return false;
    }

    await this.redis.del(lockKey);
    return true;
  }

  async getLock(resourceId: string): Promise<Lock | null> {
    const lockKey = `${this.keyPrefix}lock:${resourceId}`;
    const data = await this.redis.get(lockKey);

    if (!data) {
      return null;
    }

    const lock: Lock = JSON.parse(data);

    // Check if lock is expired
    if (new Date(lock.expiresAt) <= new Date()) {
      await this.redis.del(lockKey);
      return null;
    }

    return lock;
  }

  async renewLock(resourceId: string, userId: string, timeout?: number): Promise<Lock | null> {
    const lock = await this.getLock(resourceId);

    if (!lock || lock.userId !== userId) {
      return null;
    }

    const lockTimeout = Math.min(timeout || this.defaultTimeout, this.maxTimeout);
    lock.expiresAt = new Date(Date.now() + lockTimeout);

    const lockKey = `${this.keyPrefix}lock:${resourceId}`;
    const ttl = Math.floor(lockTimeout / 1000);
    await this.redis.setex(lockKey, ttl, JSON.stringify(lock));

    return lock;
  }

  async isLocked(resourceId: string): Promise<boolean> {
    const lock = await this.getLock(resourceId);
    return lock !== null;
  }

  async isLockedByUser(resourceId: string, userId: string): Promise<boolean> {
    const lock = await this.getLock(resourceId);
    return lock !== null && lock.userId === userId;
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
