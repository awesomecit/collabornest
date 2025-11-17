#!/usr/bin/env node
/**
 * DEBUG: Scenario 8 - Multi-tab presence tracking
 * Isolated test with detailed logging to understand event flow
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const TEST_CONFIG = require('./test-config');
const { waitForEvent, emitAndWait } = require('./event-helpers');

// Test configuration
const WS_URL = TEST_CONFIG.websocket.url;
const JWT_SECRET = TEST_CONFIG.jwt.secret;
const JWT_ISSUER = TEST_CONFIG.jwt.issuer;
const JWT_AUDIENCE = TEST_CONFIG.jwt.audience;

const WsEvent = {
  RESOURCE_JOIN: 'resource:join',
  RESOURCE_JOINED: 'resource:joined',
  RESOURCE_LEAVE: 'resource:leave',
  USER_JOINED: 'user:joined',
};

function log(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}:`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

function createValidJWT(userId) {
  return jwt.sign(
    {
      sub: userId,
      username: `user_${userId}`,
      email: `${userId}@example.com`,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function connectClient(token, userId) {
  return new Promise((resolve, reject) => {
    log(`[${userId}] Connecting to ${WS_URL}...`);

    const client = io(WS_URL, {
      path: TEST_CONFIG.websocket.path,
      transports: TEST_CONFIG.websocket.transports,
      auth: { token },
      reconnection: false,
    });

    client.on('connect', () => {
      log(`[${userId}] ✅ Connected`, { socketId: client.id });
      resolve(client);
    });

    client.on('connect_error', err => {
      log(`[${userId}] ❌ Connection error`, { error: err.message });
      reject(err);
    });

    client.on('disconnect', reason => {
      log(`[${userId}] 🔌 Disconnected`, { reason });
    });

    // Listen to ALL events for debugging
    client.onAny((eventName, ...args) => {
      log(`[${userId}] 📨 Received event: ${eventName}`, args[0]);
    });

    setTimeout(() => {
      reject(new Error(`[${userId}] Connection timeout`));
    }, TEST_CONFIG.connection.timeout);
  });
}

async function joinResourceWithAllEvents(
  client,
  userId,
  resourceId,
  mode = 'editor',
) {
  log(`[${userId}] 🚀 Joining resource: ${resourceId} as ${mode}`);

  // Register listener for resource:all_users BEFORE joining
  const allUsersPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      log(`[${userId}] ⏱️ Timeout waiting for resource:all_users`);
      resolve(null); // Don't reject, just return null
    }, TEST_CONFIG.events.slow);

    client.once('resource:all_users', data => {
      clearTimeout(timeout);
      log(`[${userId}] 🎉 Received resource:all_users`, data);
      resolve(data);
    });

    log(`[${userId}] 👂 Listener registered for resource:all_users`);
  });

  // Now emit the join
  client.emit(WsEvent.RESOURCE_JOIN, {
    resourceId,
    resourceType: 'document',
    mode,
  });

  log(`[${userId}] ✉️ Emitted RESOURCE_JOIN`, { resourceId, mode });

  // Wait for both resource:joined and resource:all_users
  const joinedPromise = waitForEvent(
    client,
    WsEvent.RESOURCE_JOINED,
    TEST_CONFIG.events.default,
  );

  const [joined, allUsers] = await Promise.all([
    joinedPromise,
    allUsersPromise,
  ]);

  log(`[${userId}] 📊 Join completed`, {
    joined: joined?.success,
    allUsersReceived: allUsers !== null,
  });

  return { joined, allUsers };
}

async function runTest() {
  console.log('\n='.repeat(80));
  console.log('🔍 DEBUG SCENARIO 8: Multi-tab Presence Tracking');
  console.log('='.repeat(80) + '\n');

  let alice, bob, charlie;

  try {
    // Step 1: Alice joins first tab
    log('STEP 1: Alice joins patient-info tab');
    const aliceToken = createValidJWT('alice');
    alice = await connectClient(aliceToken, 'alice');
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait for connection to stabilize

    const aliceResult = await joinResourceWithAllEvents(
      alice,
      'alice',
      'document:999/tab:patient-info',
      'editor',
    );

    log('STEP 1 RESULT', {
      aliceJoined: aliceResult.joined?.success,
      aliceReceivedAllUsers: aliceResult.allUsers !== null,
      aliceAllUsersData: aliceResult.allUsers,
    });

    // Step 2: Bob joins second tab
    log('\nSTEP 2: Bob joins diagnosis tab');
    const bobToken = createValidJWT('bob');
    bob = await connectClient(bobToken, 'bob');
    await new Promise(resolve => setTimeout(resolve, 500));

    const bobResult = await joinResourceWithAllEvents(
      bob,
      'bob',
      'document:999/tab:diagnosis',
      'viewer',
    );

    log('STEP 2 RESULT', {
      bobJoined: bobResult.joined?.success,
      bobReceivedAllUsers: bobResult.allUsers !== null,
      bobAllUsersData: bobResult.allUsers,
    });

    // Step 3: Charlie joins third tab
    log('\nSTEP 3: Charlie joins procedure tab');
    const charlieToken = createValidJWT('charlie');
    charlie = await connectClient(charlieToken, 'charlie');
    await new Promise(resolve => setTimeout(resolve, 500));

    const charlieResult = await joinResourceWithAllEvents(
      charlie,
      'charlie',
      'document:999/tab:procedure',
      'editor',
    );

    log('STEP 3 RESULT', {
      charlieJoined: charlieResult.joined?.success,
      charlieReceivedAllUsers: charlieResult.allUsers !== null,
      charlieAllUsersData: charlieResult.allUsers,
    });

    // Final analysis
    console.log('\n' + '='.repeat(80));
    console.log('📋 FINAL ANALYSIS');
    console.log('='.repeat(80));
    console.log(
      'Alice received resource:all_users:',
      aliceResult.allUsers !== null,
    );
    console.log(
      'Bob received resource:all_users:',
      bobResult.allUsers !== null,
    );
    console.log(
      'Charlie received resource:all_users:',
      charlieResult.allUsers !== null,
    );

    if (charlieResult.allUsers) {
      console.log('\n✅ SUCCESS: Charlie received all users data');
      console.log('Total users:', charlieResult.allUsers.totalCount);
      console.log(
        'Sub-resources:',
        charlieResult.allUsers.subResources?.length,
      );
    } else {
      console.log(
        '\n❌ FAILURE: Charlie did NOT receive resource:all_users event',
      );
      console.log(
        'This indicates the server is not emitting the event to Charlie',
      );
    }

    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    log('\nCleaning up connections...');
    if (alice) alice.disconnect();
    if (bob) bob.disconnect();
    if (charlie) charlie.disconnect();

    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  }
}

// Run test
runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
