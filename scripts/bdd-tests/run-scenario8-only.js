#!/usr/bin/env node
/**
 * Run ONLY Scenario 8 to debug
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const TEST_CONFIG = require('./test-config');
const { waitForEvent, emitAndWait } = require('./event-helpers');

const WS_URL = TEST_CONFIG.websocket.url;
const JWT_SECRET = TEST_CONFIG.jwt.secret;
const JWT_ISSUER = TEST_CONFIG.jwt.issuer;
const JWT_AUDIENCE = TEST_CONFIG.jwt.audience;

const WsEvent = {
  RESOURCE_JOIN: 'resource:join',
  RESOURCE_JOINED: 'resource:joined',
};

function log(msg, data) {
  console.log(
    `[${new Date().toISOString()}] ${msg}`,
    data ? JSON.stringify(data, null, 2) : '',
  );
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

function connectClient(token) {
  return new Promise((resolve, reject) => {
    const client = io(WS_URL, {
      path: TEST_CONFIG.websocket.path,
      transports: TEST_CONFIG.websocket.transports,
      auth: { token },
      reconnection: false,
    });
    client.on('connect', () => resolve(client));
    client.on('connect_error', err => reject(err));
    setTimeout(
      () => reject(new Error('Connection timeout')),
      TEST_CONFIG.connection.timeout,
    );
  });
}

async function runScenario8() {
  log('Starting Scenario 8 test');

  let alice, bob, charlie;
  let aliceAllUsers, bobAllUsers, charlieAllUsers;

  try {
    // Alice joins
    log('1. Connecting Alice...');
    alice = await connectClient(createValidJWT('alice'));
    log('1. Alice connected', { socketId: alice.id });

    log('1. Alice registering listener for resource:all_users...');
    const aliceAllUsersPromise = waitForEvent(
      alice,
      'resource:all_users',
      TEST_CONFIG.events.default,
    );

    log('1. Alice joining resource...');
    const aliceJoinResponse = await emitAndWait(
      alice,
      WsEvent.RESOURCE_JOIN,
      {
        resourceId: 'document:999/tab:patient-info',
        resourceType: 'document',
        mode: 'editor',
      },
      WsEvent.RESOURCE_JOINED,
      TEST_CONFIG.events.default,
    );
    log('1. Alice join response', aliceJoinResponse);

    log('1. Waiting for Alice resource:all_users...');
    aliceAllUsers = await aliceAllUsersPromise;
    log('1. Alice received all_users', aliceAllUsers);

    // Bob joins
    log('\n2. Connecting Bob...');
    bob = await connectClient(createValidJWT('bob'));
    log('2. Bob connected', { socketId: bob.id });

    log('2. Bob registering listener for resource:all_users...');
    const bobAllUsersPromise = waitForEvent(
      bob,
      'resource:all_users',
      TEST_CONFIG.events.default,
    );

    log('2. Bob joining resource...');
    const bobJoinResponse = await emitAndWait(
      bob,
      WsEvent.RESOURCE_JOIN,
      {
        resourceId: 'document:999/tab:diagnosis',
        resourceType: 'document',
        mode: 'viewer',
      },
      WsEvent.RESOURCE_JOINED,
      TEST_CONFIG.events.default,
    );
    log('2. Bob join response', bobJoinResponse);

    log('2. Waiting for Bob resource:all_users...');
    bobAllUsers = await bobAllUsersPromise;
    log('2. Bob received all_users', bobAllUsers);

    // Charlie joins
    log('\n3. Connecting Charlie...');
    charlie = await connectClient(createValidJWT('charlie'));
    log('3. Charlie connected', { socketId: charlie.id });

    log('3. Waiting 500ms for Alice/Bob to stabilize...');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.waits.medium));

    log('3. Charlie emitting RESOURCE_JOIN...');
    charlieAllUsers = await emitAndWait(
      charlie,
      WsEvent.RESOURCE_JOIN,
      {
        resourceId: 'document:999/tab:procedure',
        resourceType: 'document',
        mode: 'editor',
      },
      'resource:all_users',
      TEST_CONFIG.events.slow,
    );
    log('3. Charlie received all_users', charlieAllUsers);

    // Assertions
    log('\n✅ SUCCESS: All users received resource:all_users event');
    log('Alice totalCount:', aliceAllUsers?.totalCount);
    log('Bob totalCount:', bobAllUsers?.totalCount);
    log('Charlie totalCount:', charlieAllUsers?.totalCount);
  } catch (error) {
    log('\n❌ ERROR:', { message: error.message, stack: error.stack });
  } finally {
    log('\nCleanup...');
    if (alice) alice.disconnect();
    if (bob) bob.disconnect();
    if (charlie) charlie.disconnect();
    setTimeout(() => process.exit(0), 1000);
  }
}

runScenario8();
