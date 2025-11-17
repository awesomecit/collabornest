import { Test, TestingModule } from '@nestjs/testing';
import { RedisLockService } from './redis-lock.service';
import Redis from 'ioredis';

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisLockService],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);

    // Initialize service (calls onModuleInit)
    await service.onModuleInit();

    // Clean up test keys before each test
    const keys = await redis.keys('lock:*');
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
      const existingLock = await redis.get(`lock:${TEST_RESOURCE_ID}`);
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
      const lockData = await redis.get(`lock:${TEST_RESOURCE_ID}`);
      expect(lockData).not.toBeNull();

      const lockInfo = JSON.parse(lockData!);
      expect(lockInfo.userId).toBe(USER_A);
      expect(lockInfo.acquiredAt).toBeGreaterThan(Date.now() - 1000); // Recent
      expect(lockInfo.expiresAt).toBeGreaterThan(Date.now()); // Future

      // AND - TTL is set (approximately 5 minutes)
      const ttl = await redis.pttl(`lock:${TEST_RESOURCE_ID}`);
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
   * BDD Scenario 2: Release lock (placeholder - implement after Scenario 1)
   */
  describe('Scenario 2: Release lock', () => {
    it.todo('should release lock when held by user');
    it.todo('should deny release when lock held by different user');
    it.todo('should be idempotent when no lock exists');
  });

  /**
   * BDD Scenario 3: Lock TTL expiry (placeholder)
   */
  describe('Scenario 3: Lock TTL expiry', () => {
    it.todo('should auto-expire lock after TTL');
    it.todo('should allow new lock acquisition after expiry');
  });

  /**
   * BDD Scenario 4: Lock renewal/heartbeat (placeholder)
   */
  describe('Scenario 4: Lock renewal', () => {
    it.todo('should renew lock TTL when held by user');
    it.todo('should deny renewal when lock held by different user');
  });

  /**
   * BDD Scenario 5: Lock holder inspection (placeholder)
   */
  describe('Scenario 5: Get lock holder', () => {
    it.todo('should return lock info when lock exists');
    it.todo('should return null when no lock exists');
  });

  /**
   * BDD Scenario 6: Redis failure handling (placeholder)
   */
  describe('Scenario 6: Error handling', () => {
    it.todo('should throw error when Redis unavailable');
    it.todo('should handle connection loss gracefully');
  });
});
