import { Test, TestingModule } from '@nestjs/testing';
import { RedisLockService } from './redis-lock.service';
import Redis from 'ioredis';
import { RedisKeyFactory } from '../constants/redis-keys.enum';

/**
 * BE-001.3 Distributed Locks - BDD Tests
 *
 * TDD Red-Green-Refactor cycle:
 * 1. Write failing test (Red)
 * 2. Implement minimal solution (Green)
 * 3. Refactor for quality (Refactor)
 *
 * @see docs/project/BE-001.3-LOCK-SPECIFICATION.md
 */
describe('RedisLockService - BE-001.3 Distributed Locks (BDD)', () => {
  let service: RedisLockService;
  let redis: Redis;

  const TEST_RESOURCE_ID = 'surgery:test-123';
  const USER_A = 'user_alice';
  const USER_B = 'user_bob';
  const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes (placeholder, from meeting decision)

  beforeAll(async () => {
    // Setup test Redis connection (separate db index for isolation)
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Test database (avoid conflicts with dev db 0)
    });

    // Clear test database before tests
    await redis.flushdb();
  });

  beforeEach(async () => {
    // Create service with test Redis instance (db=15)
    // Pass undefined for config service (not needed when Redis instance provided)
    service = new RedisLockService(undefined, redis);

    // Initialize service (skips Redis creation, uses injected instance)
    await service.onModuleInit();

    // Clean up test keys before each test
    const keys = await redis.keys(RedisKeyFactory.lockPattern());
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    await service.onModuleDestroy();
  });

  afterAll(async () => {
    // Close test Redis connection
    await redis.quit();
  });

  /**
   * BDD Scenario 1: Acquire exclusive editor lock (CRITICAL PATH)
   *
   * GIVEN user_alice is a viewer on surgery:test-123
   * WHEN user_alice requests editor lock
   * THEN lock is acquired successfully
   *  AND lock key exists in Redis with user_alice as owner
   *  AND lock has TTL of 5 minutes (configurable)
   *  AND subsequent lock attempts by user_bob are denied
   */
  describe('Scenario 1: Acquire exclusive editor lock', () => {
    it('should acquire lock when no existing lock', async () => {
      // GIVEN - No existing lock
      const existingLock = await redis.get(
        RedisKeyFactory.lock(TEST_RESOURCE_ID),
      );
      expect(existingLock).toBeNull();

      // WHEN - User A requests lock
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
        DEFAULT_TTL_MS,
      );

      // THEN - Lock acquired
      expect(acquired).toBe(true);

      // AND - Lock stored in Redis
      const lockData = await redis.get(RedisKeyFactory.lock(TEST_RESOURCE_ID));
      expect(lockData).not.toBeNull();

      const lockInfo = JSON.parse(lockData!);
      expect(lockInfo.userId).toBe(USER_A);
      expect(lockInfo.acquiredAt).toBeGreaterThan(Date.now() - 1000); // Recent
      expect(lockInfo.expiresAt).toBeGreaterThan(Date.now()); // Future

      // AND - TTL is set (approximately 5 minutes)
      const ttl = await redis.pttl(RedisKeyFactory.lock(TEST_RESOURCE_ID));
      expect(ttl).toBeGreaterThan(DEFAULT_TTL_MS - 1000); // Allow 1s tolerance
      expect(ttl).toBeLessThanOrEqual(DEFAULT_TTL_MS);
    });

    it('should deny lock when already held by another user', async () => {
      // GIVEN - User A holds lock
      await service.acquireLock(TEST_RESOURCE_ID, USER_A, DEFAULT_TTL_MS);

      // WHEN - User B requests same lock
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_B,
        DEFAULT_TTL_MS,
      );

      // THEN - Lock denied
      expect(acquired).toBe(false);

      // AND - Original lock still held by User A
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_A);
    });

    it('should allow same user to reacquire lock (idempotent)', async () => {
      // GIVEN - User A holds lock
      await service.acquireLock(TEST_RESOURCE_ID, USER_A, DEFAULT_TTL_MS);

      // WHEN - User A requests lock again
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
        DEFAULT_TTL_MS,
      );

      // THEN - Lock reacquired (or kept)
      expect(acquired).toBe(true);

      // AND - Still User A's lock
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_A);
    });
  });

  /**
   * BDD Scenario 2: Release lock
   *
   * GIVEN user_alice holds editor lock on surgery:test-123
   * WHEN user_alice releases lock
   * THEN lock is removed from Redis
   *  AND subsequent lock attempts succeed
   *  AND releasing by user_bob is denied (not lock owner)
   *  AND releasing non-existent lock is idempotent (returns false)
   */
  describe('Scenario 2: Release lock', () => {
    it('should release lock when held by user', async () => {
      // Acquire lock first
      const acquired = await service.acquireLock(TEST_RESOURCE_ID, USER_A);
      expect(acquired).toBe(true);

      // Release lock
      const released = await service.releaseLock(TEST_RESOURCE_ID, USER_A);
      expect(released).toBe(true);

      // Verify lock removed
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo).toBeNull();

      // Verify new acquisition succeeds
      const reacquired = await service.acquireLock(TEST_RESOURCE_ID, USER_B);
      expect(reacquired).toBe(true);
    });

    it('should deny release when lock held by different user', async () => {
      // User A acquires lock
      const acquired = await service.acquireLock(TEST_RESOURCE_ID, USER_A);
      expect(acquired).toBe(true);

      // User B attempts to release
      const released = await service.releaseLock(TEST_RESOURCE_ID, USER_B);
      expect(released).toBe(false);

      // Verify lock still held by User A
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_A);
    });

    it('should be idempotent when no lock exists', async () => {
      // Attempt to release non-existent lock
      const released = await service.releaseLock(TEST_RESOURCE_ID, USER_A);
      expect(released).toBe(false);

      // Verify no side effects
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo).toBeNull();
    });
  });

  /**
   * BDD Scenario 3: Lock TTL expiry
   *
   * GIVEN user_alice holds lock with short TTL (100ms)
   * WHEN TTL expires
   * THEN lock is automatically removed by Redis
   *  AND getLockHolder returns null
   *  AND new user can acquire lock
   */
  describe('Scenario 3: Lock TTL expiry', () => {
    it('should auto-expire lock after TTL', async () => {
      // GIVEN - User A acquires lock with short TTL (100ms)
      const shortTtl = 100;
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
        shortTtl,
      );
      expect(acquired).toBe(true);

      // Verify lock exists
      const lockBeforeExpiry = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockBeforeExpiry).not.toBeNull();
      expect(lockBeforeExpiry?.userId).toBe(USER_A);

      // WHEN - Wait for TTL to expire (150ms > 100ms TTL)
      await new Promise(resolve => setTimeout(resolve, 150));

      // THEN - Lock auto-expired (Redis removed key)
      const lockAfterExpiry = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockAfterExpiry).toBeNull();
    });

    it('should allow new lock acquisition after expiry', async () => {
      // GIVEN - User A acquires lock with short TTL (100ms)
      const shortTtl = 100;
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
        shortTtl,
      );
      expect(acquired).toBe(true);

      // WHEN - Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // THEN - User B can acquire lock (no conflict)
      const reacquired = await service.acquireLock(TEST_RESOURCE_ID, USER_B);
      expect(reacquired).toBe(true);

      // AND - Lock now held by User B
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_B);
    });
  });

  /**
   * BDD Scenario 4: Lock renewal/heartbeat
   *
   * GIVEN user_alice holds editor lock on surgery:test-123
   * WHEN user_alice renews lock (heartbeat every 60s per meeting decision)
   * THEN lock TTL is extended
   *  AND acquiredAt timestamp is preserved
   *  AND renewal by user_bob is denied (not lock owner)
   */
  describe('Scenario 4: Lock renewal', () => {
    it('should renew lock TTL when held by user', async () => {
      // Acquire lock with short TTL (100ms for testing)
      const shortTtl = 100;
      const acquired = await service.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
        shortTtl,
      );
      expect(acquired).toBe(true);

      // Get original acquiredAt timestamp
      const originalLock = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(originalLock).not.toBeNull();
      const originalAcquiredAt = originalLock!.acquiredAt;

      // Wait 50ms (halfway to expiry)
      await new Promise(resolve => setTimeout(resolve, 50));

      // Renew lock with new TTL (200ms)
      const newTtl = 200;
      const renewed = await service.renewLock(TEST_RESOURCE_ID, USER_A, newTtl);
      expect(renewed).toBe(true);

      // Verify acquiredAt unchanged
      const renewedLock = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(renewedLock?.acquiredAt).toBe(originalAcquiredAt);

      // Wait 150ms (original lock would have expired)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify lock still active (due to renewal)
      const stillActive = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(stillActive).not.toBeNull();
      expect(stillActive?.userId).toBe(USER_A);
    });

    it('should deny renewal when lock held by different user', async () => {
      // User A acquires lock
      const acquired = await service.acquireLock(TEST_RESOURCE_ID, USER_A);
      expect(acquired).toBe(true);

      // User B attempts to renew
      const renewed = await service.renewLock(TEST_RESOURCE_ID, USER_B);
      expect(renewed).toBe(false);

      // Verify lock still held by User A
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_A);
    });
  });

  /**
   * BDD Scenario 5: Lock holder inspection
   *
   * GIVEN lock may or may not exist
   * WHEN getLockHolder is called
   * THEN returns lock metadata if exists, null otherwise
   *  AND does not modify lock state (read-only)
   */
  describe('Scenario 5: Get lock holder', () => {
    it('should return lock info when lock exists', async () => {
      // GIVEN - User A holds lock
      await service.acquireLock(TEST_RESOURCE_ID, USER_A, DEFAULT_TTL_MS);

      // WHEN - Get lock holder
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);

      // THEN - Returns lock metadata
      expect(lockInfo).not.toBeNull();
      expect(lockInfo?.userId).toBe(USER_A);
      expect(lockInfo?.acquiredAt).toBeGreaterThan(Date.now() - 1000);
      expect(lockInfo?.expiresAt).toBeGreaterThan(Date.now());

      // AND - Lock still exists (read-only operation)
      const stillExists = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(stillExists).not.toBeNull();
      expect(stillExists?.userId).toBe(USER_A);
    });

    it('should return null when no lock exists', async () => {
      // GIVEN - No lock exists
      const existingLock = await redis.get(
        RedisKeyFactory.lock(TEST_RESOURCE_ID),
      );
      expect(existingLock).toBeNull();

      // WHEN - Get lock holder
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);

      // THEN - Returns null
      expect(lockInfo).toBeNull();
    });
  });

  /**
   * BDD Scenario 6: Error handling
   *
   * GIVEN Redis connection issues
   * WHEN lock operations attempted
   * THEN operations fail gracefully
   *  AND return false (no exceptions thrown)
   *  AND log errors appropriately
   */
  describe('Scenario 6: Error handling', () => {
    it('should return false when Redis not initialized', async () => {
      // GIVEN - Service without Redis connection
      const uninitializedService = new RedisLockService(undefined, undefined);

      // WHEN - Attempt lock operations
      const acquired = await uninitializedService.acquireLock(
        TEST_RESOURCE_ID,
        USER_A,
      );
      const released = await uninitializedService.releaseLock(
        TEST_RESOURCE_ID,
        USER_A,
      );
      const renewed = await uninitializedService.renewLock(
        TEST_RESOURCE_ID,
        USER_A,
      );
      const lockInfo =
        await uninitializedService.getLockHolder(TEST_RESOURCE_ID);

      // THEN - All operations return false/null (no exceptions)
      expect(acquired).toBe(false);
      expect(released).toBe(false);
      expect(renewed).toBe(false);
      expect(lockInfo).toBeNull();
    });

    it('should handle corrupted lock data gracefully', async () => {
      // GIVEN - Corrupted lock data in Redis
      await redis.set(RedisKeyFactory.lock(TEST_RESOURCE_ID), 'invalid-json-{');

      // WHEN - User attempts to acquire lock
      const acquired = await service.acquireLock(TEST_RESOURCE_ID, USER_A);

      // THEN - Treats as no lock (allows acquisition)
      expect(acquired).toBe(true);

      // AND - Lock now valid
      const lockInfo = await service.getLockHolder(TEST_RESOURCE_ID);
      expect(lockInfo?.userId).toBe(USER_A);
    });
  });
});
