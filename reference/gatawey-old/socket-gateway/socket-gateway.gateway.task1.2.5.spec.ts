import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Socket } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

/**
 * Task 1.2.5 - Connection Pool Tracking
 * Tests for in-memory connection pool management
 */
describe('CollaborationSocketGateway - Task 1.2.5 - Connection Pool Tracking', () => {
  let gateway: CollaborationSocketGateway;
  let configService: SocketGatewayConfigService;

  // Valid JWT token for testing
  const validToken =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(
      JSON.stringify({
        sub: 'user123',
        preferred_username: 'testuser',
        given_name: 'Test',
        family_name: 'User',
        email: 'test@example.com',
        realm_access: { roles: ['user'] },
        exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
      }),
    ).toString('base64') +
    '.signature';

  beforeEach(async () => {
    const mockConfig = createMockConfigService();
    mockConfig.getMaxConnectionsPerUser = jest.fn().mockReturnValue(999); // High limit for tests

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationSocketGateway,
        {
          provide: SocketGatewayConfigService,
          useValue: mockConfig,
        },
        {
          provide: SurgeryManagementService,
          useValue: createMockSurgeryService(),
        },
      ],
    }).compile();

    gateway = module.get<CollaborationSocketGateway>(CollaborationSocketGateway);
    configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
  });

  const createMockClient = (
    overrides?: Partial<Socket>,
  ): Partial<Socket> => {
    return {
      id: `socket-${Math.random().toString(36).substr(2, 9)}`,
      handshake: {
        auth: { token: validToken },
        address: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        time: Date.now().toString(),
      } as any,
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      ...overrides,
    };
  };

  const createAuthenticatedClient = (
    overrides?: { userId?: string; transport?: string },
  ): Partial<Socket> => {
    const userId = overrides?.userId || 'user123';
    const transport = overrides?.transport || 'websocket';

    const token =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          sub: userId,
          preferred_username: `user_${userId}`,
          given_name: 'Test',
          family_name: 'User',
          email: `${userId}@example.com`,
          realm_access: { roles: ['user'] },
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64') +
      '.signature';

    return createMockClient({
      handshake: {
        auth: { token },
        address: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      } as any,
      conn: {
        transport: { name: transport },
      } as any,
    });
  };

  describe('Connection Pool Management', () => {
    it('should add connection to pool on connect', () => {
      // GIVEN
      const client = createAuthenticatedClient() as Socket;

      // WHEN
      gateway.handleConnection(client);

      // THEN
      const pool = gateway.getConnectionPool();
      expect(pool.has(client.id)).toBe(true);
      expect(pool.size).toBe(1);

      const connectionInfo = pool.get(client.id);
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo.socketId).toBe(client.id);
      expect(connectionInfo.userId).toBe('user123');
      expect(connectionInfo.transport).toBe('websocket');
    });

    it('should remove connection from pool on disconnect', () => {
      // GIVEN
      const client = createAuthenticatedClient() as Socket;
      gateway.handleConnection(client);

      // WHEN
      gateway.handleDisconnect(client);

      // THEN
      const pool = gateway.getConnectionPool();
      expect(pool.has(client.id)).toBe(false);
      expect(pool.size).toBe(0);
    });

    it('should track multiple connections per user', () => {
      // GIVEN
      const client1 = createAuthenticatedClient({ userId: 'user123' }) as Socket;
      const client2 = createAuthenticatedClient({ userId: 'user123' }) as Socket;
      const client3 = createAuthenticatedClient({ userId: 'user456' }) as Socket;

      // WHEN
      gateway.handleConnection(client1);
      gateway.handleConnection(client2);
      gateway.handleConnection(client3);

      // THEN
      const connectionsByUser = gateway.getConnectionsByUser('user123');
      expect(connectionsByUser.length).toBe(2);
      expect(connectionsByUser).toContain(client1.id);
      expect(connectionsByUser).toContain(client2.id);
    });

    it('should get connection metrics', () => {
      // GIVEN - Create 10 connections
      const clients = [];
      for (let i = 1; i <= 10; i++) {
        const client = createAuthenticatedClient({ userId: `user${i}` }) as Socket;
        clients.push(client);
        gateway.handleConnection(client);
      }

      // WHEN
      const metrics = gateway.getConnectionMetrics();

      // THEN
      expect(metrics.totalConnections).toBe(10);
      expect(metrics.activeConnections).toBe(10);
      expect(metrics.connectionsByTransport.websocket).toBe(10);
      expect(metrics.connectionsByTransport.polling).toBe(0);
    });

    it('should track transport type distribution', () => {
      // GIVEN
      const wsClient1 = createAuthenticatedClient({ transport: 'websocket' }) as Socket;
      const wsClient2 = createAuthenticatedClient({ transport: 'websocket' }) as Socket;
      const pollingClient = createAuthenticatedClient({ transport: 'polling' }) as Socket;

      // WHEN
      gateway.handleConnection(wsClient1);
      gateway.handleConnection(wsClient2);
      gateway.handleConnection(pollingClient);
      const metrics = gateway.getConnectionMetrics();

      // THEN
      expect(metrics.connectionsByTransport.websocket).toBe(2);
      expect(metrics.connectionsByTransport.polling).toBe(1);
    });
  });
});
