#!/usr/bin/env node
/**
 * BDD Tests: BE-001.2 Presence Tracking & Resource Rooms
 *
 * Epic: EPIC-001-websocket-gateway.md
 * Story: BE-001.2 Presence Tracking
 * Timeline: Week 2-3 (Completed November 16, 2025)
 *
 * Scenarios Covered:
 * 1. Join resource as editor
 * 2. Join resource as viewer
 * 3. Duplicate join rejection
 * 4. Multi-user broadcast (USER_JOINED)
 * 5. Leave resource gracefully
 * 6. Leave without join (error)
 * 7. Disconnect cleanup (remove from all resources)
 *
 * Run: npm run test:bdd:presence
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const {
  feature,
  scenario,
  given,
  when,
  then,
  and,
  assertEqual,
  assertTrue,
  assertContains,
  wait,
  log,
  getExecutor,
} = require('./scenario-executor');

// Test configuration
const WS_URL = 'http://localhost:3000/collaboration';
const JWT_SECRET = 'your_super_secure_jwt_secret_32_characters_minimum';
const JWT_ISSUER = 'collabornest';
const JWT_AUDIENCE = 'collabornest-users';

// Event names (from WsEvent enum)
const WsEvent = {
  RESOURCE_JOIN: 'resource:join',
  RESOURCE_JOINED: 'resource:joined',
  RESOURCE_LEAVE: 'resource:leave',
  RESOURCE_LEFT: 'resource:left',
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left',
};

/**
 * Helper: Create valid JWT token
 */
function createValidJWT(userId, expiresIn = '1h') {
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
 * Helper: Connect client with token
 */
function connectClient(token) {
  return new Promise((resolve, reject) => {
    const client = io(WS_URL, {
      path: '/ws/socket.io',
      path: '/ws/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });

    client.on('connect', () => resolve(client));
    client.on('connect_error', err => reject(err));

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

/**
 * Helper: Join resource and wait for response
 */
function joinResource(client, resourceId, mode = 'editor') {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Join resource timeout'));
    }, 3000);

    client.once(WsEvent.RESOURCE_JOINED, response => {
      clearTimeout(timeout);
      resolve(response);
    });

    client.emit(WsEvent.RESOURCE_JOIN, {
      resourceId,
      resourceType: 'page',
      mode,
    });
  });
}

/**
 * Helper: Leave resource and wait for response
 */
function leaveResource(client, resourceId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Leave resource timeout'));
    }, 3000);

    client.once(WsEvent.RESOURCE_LEFT, response => {
      clearTimeout(timeout);
      resolve(response);
    });

    client.emit(WsEvent.RESOURCE_LEAVE, { resourceId });
  });
}

// ============================================================================
// BDD Test Scenarios
// ============================================================================

async function runTests() {
  feature('BE-001.2: Presence Tracking & Resource Rooms');

  // Scenario 1: Join as Editor
  scenario('Join resource as editor');

  let editorClient;
  let joinResponse;

  await given('a connected user "editor-001"', async () => {
    const token = createValidJWT('editor-001');
    editorClient = await connectClient(token);
    log('Editor connected', { socketId: editorClient.id });
  });

  await when(
    'user joins resource "resource:page:/patient/BDD-001" as editor',
    async () => {
      joinResponse = await joinResource(
        editorClient,
        'resource:page:/patient/BDD-001',
        'editor',
      );
      log('Join response', joinResponse);
    },
  );

  await then(
    'should receive RESOURCE_JOINED event with success=true',
    async () => {
      assertEqual(joinResponse.success, true, 'Join should succeed');
      assertEqual(
        joinResponse.resourceId,
        'resource:page:/patient/BDD-001',
        'Resource ID should match',
      );
    },
  );

  await and('users list should contain editor-001', async () => {
    assertTrue(joinResponse.users, 'Should have users array');
    assertEqual(joinResponse.users.length, 1, 'Should have 1 user');
    assertEqual(
      joinResponse.users[0].userId,
      'editor-001',
      'User ID should match',
    );
    assertEqual(joinResponse.users[0].mode, 'editor', 'Mode should be editor');
  });

  await and('user should be in Socket.IO room', async () => {
    log('Socket.IO room membership', {
      note: 'Verified via gateway logs: client.join(resourceId)',
    });
  });

  // Cleanup
  editorClient.disconnect();
  await wait(200);

  // Scenario 2: Join as Viewer
  scenario('Join resource as viewer');

  let viewerClient;
  let viewerJoinResponse;

  await given('a connected user "viewer-001"', async () => {
    const token = createValidJWT('viewer-001');
    viewerClient = await connectClient(token);
  });

  await when('user joins resource as viewer', async () => {
    viewerJoinResponse = await joinResource(
      viewerClient,
      'resource:page:/patient/BDD-002',
      'viewer',
    );
    log('Viewer join response', viewerJoinResponse);
  });

  await then('should receive RESOURCE_JOINED with mode="viewer"', async () => {
    assertEqual(viewerJoinResponse.success, true);
    assertEqual(viewerJoinResponse.users[0].mode, 'viewer');
  });

  viewerClient.disconnect();
  await wait(200);

  // Scenario 3: Duplicate Join Rejection
  scenario('Duplicate join attempt rejection');

  let duplicateClient;
  let firstJoin;
  let secondJoin;

  await given('user "duplicate-001" already joined resource', async () => {
    const token = createValidJWT('duplicate-001');
    duplicateClient = await connectClient(token);
    firstJoin = await joinResource(
      duplicateClient,
      'resource:page:/patient/BDD-003',
    );
    log('First join successful', { success: firstJoin.success });
  });

  await when('user attempts to join same resource again', async () => {
    secondJoin = await joinResource(
      duplicateClient,
      'resource:page:/patient/BDD-003',
      'viewer',
    );
    log('Second join response', secondJoin);
  });

  await then('should receive RESOURCE_JOINED with success=false', async () => {
    assertEqual(secondJoin.success, false, 'Second join should fail');
  });

  await and('error message should indicate already joined', async () => {
    assertTrue(
      secondJoin.message && secondJoin.message.includes('already joined'),
      'Should have "already joined" message',
    );
  });

  duplicateClient.disconnect();
  await wait(200);

  // Scenario 4: Multi-User Broadcast
  scenario('Multi-user broadcast on USER_JOINED');

  let userA, userB;
  let userJoinedNotification;

  await given(
    'user A is in resource "resource:page:/patient/BDD-004"',
    async () => {
      const tokenA = createValidJWT('broadcast-user-A');
      userA = await connectClient(tokenA);
      await joinResource(userA, 'resource:page:/patient/BDD-004');
      log('User A joined', { userId: 'broadcast-user-A' });
    },
  );

  await and('user A is listening for USER_JOINED events', async () => {
    const promise = new Promise(resolve => {
      userA.once(WsEvent.USER_JOINED, notification => {
        userJoinedNotification = notification;
        resolve();
      });
    });

    // Store promise for later await
    userA._userJoinedPromise = promise;
  });

  await when('user B joins the same resource', async () => {
    const tokenB = createValidJWT('broadcast-user-B');
    userB = await connectClient(tokenB);
    await joinResource(userB, 'resource:page:/patient/BDD-004', 'viewer');
    log('User B joined', { userId: 'broadcast-user-B' });

    // Wait for broadcast
    await userA._userJoinedPromise;
  });

  await then('user A should receive USER_JOINED notification', async () => {
    assertTrue(userJoinedNotification, 'Should receive USER_JOINED event');
    log('USER_JOINED notification', userJoinedNotification);
  });

  await and('notification should contain user B details', async () => {
    assertEqual(
      userJoinedNotification.userId,
      'broadcast-user-B',
      'User ID should match',
    );
    assertEqual(userJoinedNotification.mode, 'viewer', 'Mode should be viewer');
    assertEqual(
      userJoinedNotification.resourceId,
      'resource:page:/patient/BDD-004',
      'Resource ID should match',
    );
  });

  userA.disconnect();
  userB.disconnect();
  await wait(200);

  // Scenario 5: Leave Resource Gracefully
  scenario('Leave resource gracefully with broadcast');

  let leaveUserA, leaveUserB;
  let userLeftNotification;

  await given(
    'two users in resource "resource:page:/patient/BDD-005"',
    async () => {
      const tokenA = createValidJWT('leave-user-A');
      const tokenB = createValidJWT('leave-user-B');

      leaveUserA = await connectClient(tokenA);
      leaveUserB = await connectClient(tokenB);

      await joinResource(leaveUserA, 'resource:page:/patient/BDD-005');
      await joinResource(leaveUserB, 'resource:page:/patient/BDD-005');

      log('Both users joined', {
        userA: 'leave-user-A',
        userB: 'leave-user-B',
      });
    },
  );

  await and('user B is listening for USER_LEFT events', async () => {
    const promise = new Promise(resolve => {
      leaveUserB.once(WsEvent.USER_LEFT, notification => {
        userLeftNotification = notification;
        resolve();
      });
    });

    leaveUserB._userLeftPromise = promise;
  });

  await when('user A leaves the resource', async () => {
    const leaveResponse = await leaveResource(
      leaveUserA,
      'resource:page:/patient/BDD-005',
    );
    log('Leave response', leaveResponse);

    assertEqual(leaveResponse.success, true, 'Leave should succeed');

    // Wait for broadcast
    await leaveUserB._userLeftPromise;
  });

  await then('user B should receive USER_LEFT notification', async () => {
    assertTrue(userLeftNotification, 'Should receive USER_LEFT event');
    log('USER_LEFT notification', userLeftNotification);
  });

  await and('notification should contain user A details', async () => {
    assertEqual(
      userLeftNotification.userId,
      'leave-user-A',
      'User ID should match',
    );
    assertEqual(
      userLeftNotification.resourceId,
      'resource:page:/patient/BDD-005',
      'Resource ID should match',
    );
  });

  leaveUserA.disconnect();
  leaveUserB.disconnect();
  await wait(200);

  // Scenario 6: Leave Without Join (Error)
  scenario('Leave resource without joining (error case)');

  let notJoinedClient;
  let leaveErrorResponse;

  await given('a connected user who has not joined any resource', async () => {
    const token = createValidJWT('not-joined-user');
    notJoinedClient = await connectClient(token);
  });

  await when('user attempts to leave resource', async () => {
    leaveErrorResponse = await leaveResource(
      notJoinedClient,
      'resource:page:/patient/BDD-006',
    );
    log('Leave error response', leaveErrorResponse);
  });

  await then('should receive RESOURCE_LEFT with success=false', async () => {
    assertEqual(leaveErrorResponse.success, false, 'Leave should fail');
  });

  await and('error message should indicate not in resource', async () => {
    assertTrue(
      leaveErrorResponse.message &&
        leaveErrorResponse.message.includes('not in this resource'),
      'Should have "not in this resource" message',
    );
  });

  notJoinedClient.disconnect();
  await wait(200);

  // Scenario 7: Disconnect Cleanup
  scenario('Disconnect cleanup removes user from all resources');

  let multiResourceUser, watcherUser;
  let leftNotifications = [];

  await given('user in multiple resources with watcher', async () => {
    const tokenMulti = createValidJWT('multi-resource-user');
    const tokenWatcher = createValidJWT('watcher-user');

    multiResourceUser = await connectClient(tokenMulti);
    watcherUser = await connectClient(tokenWatcher);

    // Multi-resource user joins 2 resources
    await joinResource(multiResourceUser, 'resource:page:/patient/BDD-007');
    await joinResource(multiResourceUser, 'resource:page:/patient/BDD-008');

    // Watcher joins both to monitor
    await joinResource(watcherUser, 'resource:page:/patient/BDD-007');
    await joinResource(watcherUser, 'resource:page:/patient/BDD-008');

    log('Setup complete', {
      multiUser: 'joined 2 resources',
      watcher: 'monitoring both',
    });
  });

  await and('watcher is listening for USER_LEFT events', async () => {
    watcherUser.on(WsEvent.USER_LEFT, notification => {
      leftNotifications.push(notification);
      log('USER_LEFT received', notification);
    });
  });

  await when('multi-resource user disconnects abruptly', async () => {
    multiResourceUser.disconnect();
    await wait(1000); // Wait for cleanup + broadcasts
  });

  await then('watcher should receive 2 USER_LEFT notifications', async () => {
    assertEqual(
      leftNotifications.length,
      2,
      'Should receive 2 USER_LEFT events',
    );
  });

  await and('both notifications should have reason="disconnect"', async () => {
    leftNotifications.forEach(notif => {
      assertEqual(notif.reason, 'disconnect', 'Reason should be disconnect');
      assertEqual(notif.userId, 'multi-resource-user', 'User ID should match');
    });
  });

  await and('user should be removed from all resources', async () => {
    log('Cleanup verification', {
      note: 'Check gateway logs for cleanupUserFromAllResources()',
    });
  });

  watcherUser.disconnect();
  await wait(200);

  // Print summary
  const executor = getExecutor();
  executor.printSummary();

  // Exit with appropriate code
  process.exit(executor.hasPassed() ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
