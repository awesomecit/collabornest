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
const { TEST_CONFIG } = require('./test-config');
const { emitAndWait, waitForEvent } = require('./event-helpers');

describe('BE-001.3: Distributed Locks', () => {
  const SERVER_URL = TEST_CONFIG.websocket.url;
  const JWT_TOKEN = TEST_CONFIG.jwt.validToken;

  let aliceClient, bobClient, charlieClient;

  /**
   * Connect client with JWT authentication
   */
  async function connectClient(username) {
    return new Promise((resolve, reject) => {
      const client = io(SERVER_URL, {
        path: TEST_CONFIG.websocket.path,
        auth: { token: JWT_TOKEN },
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
      success: true,
      resourceId,
      lockId: expect.stringContaining('lock:'),
      expiresAt: expect.any(String),
    });

    // Verify TTL is ~30 seconds (default)
    const expiresAt = new Date(acquireResponse.expiresAt);
    const now = new Date();
    const ttlSeconds = (expiresAt - now) / 1000;
    expect(ttlSeconds).toBeGreaterThan(25);
    expect(ttlSeconds).toBeLessThan(35);
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
      success: false,
      resourceId,
      reason: expect.stringContaining('already locked'),
      lockedBy: expect.objectContaining({
        userId: expect.any(String),
        username: expect.any(String),
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
      success: true,
      resourceId,
      expiresAt: expect.any(String),
    });

    // Verify new expiresAt is later than original
    const newExpiresAt = new Date(extendResponse.expiresAt);
    expect(newExpiresAt.getTime()).toBeGreaterThan(firstExpiresAt.getTime());
  }, 15000); // Increase timeout to 15s

  /**
   * Scenario 4: Lock expires automatically after TTL
   *
   * GIVEN Alice holds lock with 5-second TTL (for testing)
   * AND Alice becomes inactive
   * WHEN 5 seconds pass without lock extension
   * THEN Redis should automatically delete the lock key
   * AND Bob should receive "lock:expired" broadcast
   * AND resource should become available for locking
   */
  test('Scenario 4: Lock expires automatically after TTL', async () => {
    const resourceId = 'document:test-004/field:input-short-ttl';

    // Alice acquires lock with short TTL (5 seconds for testing)
    await emitAndWait(
      aliceClient,
      'lock:acquire',
      { resourceId, ttl: 5000 },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    // Bob listens for lock expiration
    const expiredPromise = waitForEvent(bobClient, 'lock:expired', 7000);

    // Wait for TTL to expire (6 seconds)
    await new Promise(resolve => setTimeout(resolve, 6000));

    const expiredEvent = await expiredPromise;

    expect(expiredEvent).toMatchObject({
      resourceId,
      previousHolder: expect.objectContaining({
        userId: expect.any(String),
      }),
    });

    // Bob should now be able to acquire lock
    const bobAcquire = await emitAndWait(
      bobClient,
      'lock:acquire',
      { resourceId },
      'lock:acquired',
      TEST_CONFIG.events.default,
    );

    expect(bobAcquire.success).toBe(true);
  }, 10000); // Increase timeout to 10s

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

    // Alice acquires 2 locks
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

    // Bob listens for lock releases
    const release1Promise = waitForEvent(
      bobClient,
      'lock:released',
      TEST_CONFIG.events.slow,
    );
    const release2Promise = waitForEvent(
      bobClient,
      'lock:released',
      TEST_CONFIG.events.slow,
    );

    // Alice disconnects
    aliceClient.close();

    // Wait for lock release broadcasts
    const [release1, release2] = await Promise.all([
      release1Promise,
      release2Promise,
    ]);

    expect(release1).toMatchObject({
      resourceId: expect.any(String),
      reason: 'disconnect',
    });

    expect(release2).toMatchObject({
      resourceId: expect.any(String),
      reason: 'disconnect',
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

    expect(bobAcquire1.success).toBe(true);
    expect(bobAcquire2.success).toBe(true);
  });

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
    const [aliceResult, bobResult, charlieResult] = await Promise.allSettled([
      emitAndWait(
        aliceClient,
        'lock:acquire',
        { resourceId },
        ['lock:acquired', 'lock:denied'],
        TEST_CONFIG.events.default,
      ),
      emitAndWait(
        bobClient,
        'lock:acquire',
        { resourceId },
        ['lock:acquired', 'lock:denied'],
        TEST_CONFIG.events.default,
      ),
      emitAndWait(
        charlieClient,
        'lock:acquire',
        { resourceId },
        ['lock:acquired', 'lock:denied'],
        TEST_CONFIG.events.default,
      ),
    ]);

    // Extract responses
    const responses = [
      aliceResult.status === 'fulfilled' ? aliceResult.value : null,
      bobResult.status === 'fulfilled' ? bobResult.value : null,
      charlieResult.status === 'fulfilled' ? charlieResult.value : null,
    ].filter(Boolean);

    // Count successes and denials
    const successes = responses.filter(r => r.success === true);
    const denials = responses.filter(r => r.success === false);

    // Atomic SETNX guarantees exactly 1 success
    expect(successes).toHaveLength(1);
    expect(denials).toHaveLength(2);

    // Winner has lockId, losers have reason
    expect(successes[0]).toMatchObject({
      success: true,
      lockId: expect.any(String),
    });

    denials.forEach(denial => {
      expect(denial).toMatchObject({
        success: false,
        reason: expect.stringContaining('already locked'),
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
    const bobRelease = await emitAndWait(
      bobClient,
      'lock:release',
      { resourceId, lockId: aliceLock.lockId },
      'lock:release_denied',
      TEST_CONFIG.events.default,
    );

    expect(bobRelease).toMatchObject({
      success: false,
      reason: expect.stringContaining('not the lock owner'),
    });

    // Verify Alice still holds lock
    const charlieAttempt = await emitAndWait(
      (charlieClient = await connectClient('charlie')),
      'lock:acquire',
      { resourceId },
      'lock:denied',
      TEST_CONFIG.events.default,
    );

    expect(charlieAttempt.success).toBe(false);
  });
});
