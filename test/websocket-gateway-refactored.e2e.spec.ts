import { INestApplication } from '@nestjs/common';
import { WebSocketGatewayConfigService } from '../src/websocket-gateway/config/gateway-config.service';
import { WebSocketGateway } from '../src/websocket-gateway/websocket-gateway.gateway';
import {
  WebSocketTestSetup,
  WebSocketClientFactory,
  JWTTokenFactory,
  WebSocketAssertions,
} from '../src/websocket-gateway/websocket-test.utils';

/**
 * BE-001.1: WebSocket Connection Management - E2E Tests (Refactored)
 *
 * EPIC: EPIC-001-websocket-gateway.md
 * Test Strategy: E2E with real Socket.IO + centralized test utils
 *
 * Scenarios:
 * 1. Valid JWT authentication
 * 2. Expired JWT rejection
 * 3. Missing token rejection
 * 4. Connection pool tracking
 * 5. Max connections per user
 * 6. Heartbeat mechanism (future)
 */
describe('WebSocketGateway - E2E Tests (Refactored)', () => {
  let app: INestApplication;
  let gateway: WebSocketGateway;
  let configService: WebSocketGatewayConfigService;
  let clientFactory: WebSocketClientFactory;
  let testSetup: WebSocketTestSetup;

  const TEST_PORT = 3001;
  const TEST_NAMESPACE = '/collaboration';

  beforeAll(async () => {
    testSetup = new WebSocketTestSetup(TEST_PORT, TEST_NAMESPACE);
    const setup = await testSetup.initialize();

    app = setup.app;
    gateway = setup.gateway;
    configService = setup.configService;
    clientFactory = setup.clientFactory;
  }, 10000);

  afterAll(async () => {
    await testSetup.cleanup();
  }, 10000);

  afterEach(() => {
    testSetup.cleanupClients();
  });

  describe('Scenario 1: Valid JWT Authentication', () => {
    it('should connect client with valid JWT token', async () => {
      // WHEN
      const client = await clientFactory.createAuthenticatedClient('user123');

      // THEN
      WebSocketAssertions.expectConnected(client);
      WebSocketAssertions.expectConnectionPoolSize(gateway, 1);
    });

    it('should extract user info from JWT payload', async () => {
      // WHEN
      const client = await clientFactory.createAuthenticatedClient('user456');

      // THEN
      expect(client.id).toBeDefined();
      const connectionInfo = gateway.getConnectionInfo(client.id!);
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo?.userId).toBe('user456');
      expect(connectionInfo?.username).toBe('user_user456');
      expect(connectionInfo?.email).toBe('user456@example.com');
    });
  });

  describe('Scenario 2: Expired JWT Rejection', () => {
    it('should reject connection with expired token', async () => {
      // WHEN
      const client =
        await clientFactory.createExpiredTokenClient('expired-user');

      // Give server time to process disconnect
      await new Promise(resolve => setTimeout(resolve, 100));

      // THEN
      WebSocketAssertions.expectDisconnected(client);
      WebSocketAssertions.expectConnectionPoolSize(gateway, 0);
    });
  });

  describe('Scenario 3: Missing Token Rejection', () => {
    it('should reject connection without auth token', async () => {
      // WHEN
      const client = await clientFactory.createUnauthenticatedClient();

      // Give server time to process disconnect
      await new Promise(resolve => setTimeout(resolve, 100));

      // THEN
      WebSocketAssertions.expectDisconnected(client);
      WebSocketAssertions.expectConnectionPoolSize(gateway, 0);
    });
  });

  describe('Scenario 4: Connection Pool Tracking', () => {
    it('should track multiple connections in pool', async () => {
      // WHEN
      const client1 = await clientFactory.createAuthenticatedClient('user1');
      const client2 = await clientFactory.createAuthenticatedClient('user2');

      // THEN
      WebSocketAssertions.expectConnectionPoolSize(gateway, 2);
      expect(gateway.hasConnection(client1.id!)).toBe(true);
      expect(gateway.hasConnection(client2.id!)).toBe(true);
    });

    it('should remove connection from pool on disconnect', async () => {
      // GIVEN
      const client =
        await clientFactory.createAuthenticatedClient('disconnect-user');
      WebSocketAssertions.expectConnectionPoolSize(gateway, 1);

      // WHEN
      client.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for disconnect event

      // THEN
      WebSocketAssertions.expectConnectionPoolSize(gateway, 0);
      expect(gateway.hasConnection(client.id!)).toBe(false);
    });
  });

  describe('Scenario 5: Max Connections Per User', () => {
    it('should allow up to max connections per user', async () => {
      // GIVEN maxConnections = 5
      const userId = 'max-user';

      // WHEN
      const clients = await Promise.all([
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
      ]);

      // THEN
      WebSocketAssertions.expectUserConnectionCount(gateway, userId, 5);
      clients.forEach(client => WebSocketAssertions.expectConnected(client));
    });

    it('should reject 6th connection when max reached', async () => {
      // GIVEN 5 connections already established
      const userId = 'limit-user';
      await Promise.all([
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
      ]);

      // WHEN trying 6th connection
      const rejectedClient =
        await clientFactory.createAuthenticatedClient(userId);

      // Give server time to process disconnect
      await new Promise(resolve => setTimeout(resolve, 100));

      // THEN
      WebSocketAssertions.expectDisconnected(rejectedClient);
      WebSocketAssertions.expectUserConnectionCount(gateway, userId, 5);
    });
  });

  describe('Scenario 6: Connection Slot Reuse', () => {
    it('should allow new connection after disconnect', async () => {
      // GIVEN 5 connections
      const userId = 'reuse-user';
      const clients = await Promise.all([
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
        clientFactory.createAuthenticatedClient(userId),
      ]);

      // WHEN disconnect one
      clients[0].disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));

      // THEN new connection should be accepted
      const newClient = await clientFactory.createAuthenticatedClient(userId);
      WebSocketAssertions.expectConnected(newClient);
      WebSocketAssertions.expectUserConnectionCount(gateway, userId, 5);
    });
  });
});
