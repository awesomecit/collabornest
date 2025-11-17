/**
 * BDD Test Suite: BE-001.3 Distributed Locks
 *
 * Tests Redis-backed distributed locking with atomic operations.
 * Based on docs/PROJECT.md Story BE-001.3 (lines 479-576)
 *
 * Scenarios:
 * 1. Acquire lock on available resource
 * 2. Lock acquisition denied when already locked
 * 3. Lock auto-extends while user is active
 * 4. Lock expires automatically after TTL
 * 5. Lock released on disconnection
 * 6. Race condition handling (atomic SETNX)
 * 7. Lua script owner validation
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const TEST_CONFIG = require('./test-config');
const { emitAndWait, waitForEvent } = require('./event-helpers');

describe('BE-001.3: Distributed Locks', () => {
  const SERVER_URL = TEST_CONFIG.websocket.url;
  const JWT_SECRET = TEST_CONFIG.jwt.secret;
  const JWT_ISSUER = TEST_CONFIG.jwt.issuer;
  const JWT_AUDIENCE = TEST_CONFIG.jwt.audience;

  let aliceClient, bobClient, charlieClient;

  /**
   * Generate valid JWT token for testing
   */
  function createValidJWT(userId, expiresIn = TEST_CONFIG.jwt.expiresIn) {
    return jwt.sign(
      {
        sub: userId,
        username: `user_${userId}`,
        email: `${userId}@example.com`,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
      },
      JWT_SECRET,
      { expiresIn },
    );
  }

  /**
   * Connect client with JWT authentication
   */
  async function connectClient(username) {
    return new Promise((resolve, reject) => {
      const client = io(SERVER_URL, {
        path: TEST_CONFIG.websocket.path,
        auth: { token: createValidJWT(username) },
        transports: ['websocket'],
        reconnection: false,
      });

      const timeout = setTimeout(() => {
        client.close();
        reject(new Error(`Connection timeout for ${username}`));
      }, TEST_CONFIG.connection.timeout);

      client.on('connect', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on('connect_error', err => {
        clearTimeout(timeout);
        client.close();
        reject(err);
      });
    });
  }

  beforeEach(async () => {
    // Connect clients
    aliceClient = await connectClient('alice');
    bobClient = await connectClient('bob');
  });

  afterEach(() => {
    // Disconnect all clients
    if (aliceClient?.connected) aliceClient.close();
    if (bobClient?.connected) bobClient.close();
    if (charlieClient?.connected) charlieClient.close();
  });

  /**
   * Scenario 1: Acquire lock on available resource
   *
   * GIVEN I am connected as user "alice"
   * AND the resource "input-field-123" is not locked
   * WHEN I send "lock:acquire" event for "input-field-123"
   * THEN I should receive "lock:acquired" event with lockId and expiresAt
   * AND other users should receive "lock:status" broadcast
   */
  test('Scenario 1: Acquire lock on available resource', async () => {
    const resourceId = 'document:test-001/field:input-123';

    // Alice acquires lock
    const acquireResponse = await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    expect(acquireResponse).toMatchObject({
      resourceId,
      lockId: expect.stringContaining(resourceId),
      expiresAt: expect.any(Number),
    });

    // Verify TTL is ~5 minutes (300s default)
    const expiresAt = acquireResponse.expiresAt;
    const now = Date.now();
    const ttlSeconds = (expiresAt - now) / 1000;
    expect(ttlSeconds).toBeGreaterThan(290);
    expect(ttlSeconds).toBeLessThan(310);
  });

  /**
   * Scenario 2: Lock acquisition denied when already locked
   *
   * GIVEN user "alice" holds lock on "input-field-123"
   * WHEN "bob" attempts to acquire lock on same resource
   * THEN Bob should receive "lock:denied" event
   * AND response should indicate who holds the lock
   */
  test('Scenario 2: Lock acquisition denied when already locked', async () => {
    const resourceId = 'document:test-002/field:input-456';

    // Alice acquires lock
    await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    // Bob attempts to acquire same lock
    const denyResponse = await emitAndWait(
      bobClient,
      'lock:acquire',
      { resourceId },
      'lock:denied',
      TEST_CONFIG.events.default,
    );

    expect(denyResponse).toMatchObject({
      resourceId,
      reason: expect.stringContaining('locked'),
      lockedBy: expect.objectContaining({
        userId: 'alice',
      }),
    });
  });

  /**
   * Scenario 3: Lock auto-extends while user is active
   *
   * GIVEN Alice holds lock on resource
   * AND lock expires in 30 seconds
   * WHEN Alice sends "lock:extend" heartbeat every 20 seconds
   * THEN lock TTL should be reset to 30 seconds
   * AND lock should not expire while Alice is active
   */
  test('Scenario 3: Lock auto-extends while user is active', async () => {
    const resourceId = 'document:test-003/field:input-789';

    // Alice acquires lock
    const acquireResponse = await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    const firstExpiresAt = new Date(acquireResponse.expiresAt);

    // Wait 10 seconds, then extend lock
    await new Promise(resolve => setTimeout(resolve, 10000));

    const extendResponse = await emitAndWait(
      aliceClient,
      'lock:extend',
      { resourceId, lockId: acquireResponse.lockId },
      'lock:extended',
      TEST_CONFIG.events.default,
    );

    expect(extendResponse).toMatchObject({
      resourceId,
      expiresAt: expect.any(Number),
    });

    // Verify new expiresAt is later than original
    const newExpiresAt = new Date(extendResponse.expiresAt);
    expect(newExpiresAt.getTime()).toBeGreaterThan(firstExpiresAt.getTime());
  }, 15000); // Increase timeout to 15s

  /**
   * Scenario 4: Lock TTL mechanism (SKIPPED - unit test coverage sufficient)
   *
   * WHY SKIPPED:
   * - Gateway uses fixed 300s TTL (5 minutes) - not configurable via WebSocket API
   * - BDD test would require 5-minute wait (impractical for CI/CD)
   * - RedisLockService unit tests already verify TTL behavior with real Redis
   * - Unit test uses custom TTL (5s) and verifies expiration via `hasLock()` check
   *
   * COVERAGE:
   * - src/websocket-gateway/services/redis-lock.service.spec.ts
   *   - "should acquire lock and set TTL"
   *   - "should fail to acquire locked resource"
   *
   * If TTL configurability is needed, add `ttl` field to LockAcquireDto and update gateway.
   */
  test.skip('Scenario 4: Lock expires automatically after TTL', async () => {
    // Implementation would require 300s wait - use unit tests instead
  });

  /**
   * Scenario 5: Lock released on disconnection
   *
   * GIVEN Alice holds locks on 2 resources
   * WHEN Alice disconnects from gateway
   * THEN gateway should release all Alice's locks atomically
   * AND "lock:released" events should be broadcasted
   * AND Bob should see locks available
   */
  test('Scenario 5: Lock released on disconnection', async () => {
    const resource1 = 'document:test-005/field:input-aaa';
    const resource2 = 'document:test-005/field:input-bbb';

    // Bob joins both resources to receive lock:status broadcasts
    await emitAndWait(
      bobClient,
      'resource:join',
      { resourceId: resource1, mode: 'viewer' },
      'resource:joined',
      TEST_CONFIG.events.default,
    );

    await emitAndWait(
      bobClient,
      'resource:join',
      { resourceId: resource2, mode: 'viewer' },
      'resource:joined',
      TEST_CONFIG.events.default,
    );

    // Alice acquires 2 locks (Bob will receive lock:status with locked:true for both)
    await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId: resource1 },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId: resource2 },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    // Bob listens for lock:status broadcasts with locked:false (after disconnect)
    // Filter to ignore lock:status with locked:true (from acquisition above)
    const status1Promise = waitForEvent(
      bobClient,
      'lock:status',
      TEST_CONFIG.events.slow,
      data => data.locked === false && data.resourceId === resource1,
    );
    const status2Promise = waitForEvent(
      bobClient,
      'lock:status',
      TEST_CONFIG.events.slow,
      data => data.locked === false && data.resourceId === resource2,
    );

    // Alice disconnects (triggers releaseLocksonDisconnect)
    aliceClient.close();

    // Wait for lock:status broadcasts indicating locks released
    const [status1, status2] = await Promise.all([
      status1Promise,
      status2Promise,
    ]);

    // Both lock:status events should show locked: false
    expect(status1).toMatchObject({
      resourceId: resource1,
      locked: false,
      lockedBy: null,
    });

    expect(status2).toMatchObject({
      resourceId: resource2,
      locked: false,
      lockedBy: null,
    });

    // Bob should be able to acquire both locks
    const bobAcquire1 = await emitAndWait(
      bobClient,
      'lock:acquire',
      { resourceId: resource1 },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    const bobAcquire2 = await emitAndWait(
      bobClient,
      'lock:acquire',
      { resourceId: resource2 },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    expect(bobAcquire1).toMatchObject({ resourceId: resource1 });
    expect(bobAcquire2).toMatchObject({ resourceId: resource2 });
  }, 15000); // Increase timeout to 15s for disconnect cleanup

  /**
   * Scenario 6: Race condition handling (atomic SETNX)
   *
   * GIVEN two users attempt to lock the same resource simultaneously
   * WHEN both send "lock:acquire" at t=0ms and t=2ms
   * THEN Redis atomic NX operation should ensure only one succeeds
   * AND winner should receive "lock:acquired"
   * AND loser should receive "lock:denied"
   */
  test('Scenario 6: Race condition handling (atomic SETNX)', async () => {
    const resourceId = 'document:test-006/field:race-condition';

    charlieClient = await connectClient('charlie');

    // Simulate race condition: all 3 users attempt lock simultaneously
    // Each user registers listeners for BOTH possible outcomes before emitting
    const alicePromise = Promise.race([
      waitForEvent(aliceClient, 'lock:acquired', TEST_CONFIG.events.default),
      waitForEvent(aliceClient, 'lock:denied', TEST_CONFIG.events.default),
    ]);
    const bobPromise = Promise.race([
      waitForEvent(bobClient, 'lock:acquired', TEST_CONFIG.events.default),
      waitForEvent(bobClient, 'lock:denied', TEST_CONFIG.events.default),
    ]);
    const charliePromise = Promise.race([
      waitForEvent(charlieClient, 'lock:acquired', TEST_CONFIG.events.default),
      waitForEvent(charlieClient, 'lock:denied', TEST_CONFIG.events.default),
    ]);

    // Emit all 3 lock:acquire requests simultaneously
    aliceClient.emit('lock:acquire', { resourceId });
    bobClient.emit('lock:acquire', { resourceId });
    charlieClient.emit('lock:acquire', { resourceId });

    const [aliceResult, bobResult, charlieResult] = await Promise.allSettled([
      alicePromise,
      bobPromise,
      charliePromise,
    ]);

    // Extract responses
    const responses = [
      aliceResult.status === 'fulfilled' ? aliceResult.value : null,
      bobResult.status === 'fulfilled' ? bobResult.value : null,
      charlieResult.status === 'fulfilled' ? charlieResult.value : null,
    ].filter(Boolean);

    // Count lock:acquired vs lock:denied (no 'success' field)
    const acquired = responses.filter(r => r.lockId !== undefined);
    const denied = responses.filter(r => r.reason !== undefined);

    // Atomic SETNX guarantees exactly 1 acquired
    expect(acquired).toHaveLength(1);
    expect(denied).toHaveLength(2);

    // Winner has lockId
    expect(acquired[0]).toMatchObject({
      lockId: expect.stringContaining(resourceId),
      resourceId,
    });

    // Losers have reason + lockedBy
    denied.forEach(denial => {
      expect(denial).toMatchObject({
        reason: expect.stringContaining('locked'),
      });
    });
  });

  /**
   * Scenario 7: Lua script owner validation
   *
   * GIVEN Alice holds lock on resource
   * WHEN Bob attempts to release Alice's lock
   * THEN Lua script should validate ownership
   * AND Bob should receive "lock:release_denied" error
   * AND lock should remain held by Alice
   */
  test('Scenario 7: Lua script owner validation', async () => {
    const resourceId = 'document:test-007/field:owner-validation';

    // Alice acquires lock
    const aliceLock = await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    // Bob attempts to release Alice's lock (invalid operation)
    // Gateway emits WsEvent.ERROR with code LOCK_NOT_HELD
    const bobRelease = await emitAndWait(
      bobClient,
      'lock:release',
      { resourceId },
      'error',
      TEST_CONFIG.events.default,
    );

    expect(bobRelease).toMatchObject({
      code: 'WS_4013', // WsErrorCode.LOCK_NOT_HELD enum value
      message: expect.stringContaining('do not hold this lock'),
    });

    // Verify Alice still holds lock (Charlie gets denied)
    const charlieAttempt = await emitAndWait(
      (charlieClient = await connectClient('charlie')),
      'lock:acquire',
      { resourceId },
      'lock:denied',
      TEST_CONFIG.events.default,
    );

    expect(charlieAttempt).toMatchObject({
      resourceId,
      reason: expect.stringContaining('locked'),
    });
  });
});
