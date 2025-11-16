import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Socket } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

/**
 * Task 1.2.6 - Graceful Shutdown
 * Tests for controlled shutdown with client notification and resource cleanup
 */
describe('CollaborationSocketGateway - Task 1.2.6 - Graceful Shutdown', () => {
  let gateway: CollaborationSocketGateway;
  let configService: SocketGatewayConfigService;
  let mockServer: any;

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
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64') +
    '.signature';

  beforeEach(async () => {
    // Mock Socket.IO server
    mockServer = {
      emit: jest.fn(),
      sockets: {
        sockets: new Map(),
      },
    };

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

    // Inject mock server
    gateway.server = mockServer;
  });

  const createMockClient = (
    overrides?: Partial<Socket>,
  ): Partial<Socket> => {
    const socketId = `socket-${Math.random().toString(36).substr(2, 9)}`;
    const client: Partial<Socket> = {
      id: socketId,
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
      on: jest.fn(),
      conn: {
        transport: { name: 'websocket' },
      } as any,
      ...overrides,
    };

    // Add to server's socket map
    mockServer.sockets.sockets.set(socketId, client);

    return client;
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
        time: Date.now().toString(),
      } as any,
      conn: {
        transport: { name: transport },
      } as any,
    });
  };

  describe('Graceful Shutdown', () => {
    it('should notify all connected clients before shutdown', async () => {
      // GIVEN - Create 5 authenticated clients
      const clients = [];
      for (let i = 1; i <= 5; i++) {
        const client = createAuthenticatedClient({ userId: `user${i}` }) as Socket;
        gateway.handleConnection(client);
        clients.push(client);
      }

      // WHEN - Use short timeout for tests
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(mockServer.emit).toHaveBeenCalledWith('server:shutdown', 
        expect.objectContaining({
          message: expect.any(String),
        })
      );
    });

    it('should wait for client acknowledgments with timeout', async () => {
      // GIVEN
      const client1 = createAuthenticatedClient({ userId: 'user1' }) as Socket;
      const client2 = createAuthenticatedClient({ userId: 'user2' }) as Socket;
      
      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      // WHEN
      const startTime = Date.now();
      await gateway.gracefulShutdown({ timeout: 200 });
      const duration = Date.now() - startTime;

      // THEN - Should complete within timeout + small buffer
      expect(duration).toBeGreaterThanOrEqual(200);
      expect(duration).toBeLessThan(350); // 200ms timeout + 150ms buffer
    });

    it('should force disconnect remaining clients after timeout', async () => {
      // GIVEN
      const client = createAuthenticatedClient({ userId: 'stubborn' }) as Socket;
      gateway.handleConnection(client);

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should clear connection pool after shutdown', async () => {
      // GIVEN
      const clients = [];
      for (let i = 1; i <= 3; i++) {
        const client = createAuthenticatedClient({ userId: `user${i}` }) as Socket;
        gateway.handleConnection(client);
        clients.push(client);
      }

      // Verify pool is populated
      expect(gateway.getConnectionPool().size).toBe(3);

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(gateway.getConnectionPool().size).toBe(0);
    });

    it('should log shutdown progress', async () => {
      // GIVEN
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      for (let i = 1; i <= 3; i++) {
        const client = createAuthenticatedClient({ userId: `user${i}` }) as Socket;
        gateway.handleConnection(client);
      }

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SHUTDOWN_STARTED',
          activeConnections: 3,
        })
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SHUTDOWN_COMPLETED',
        })
      );
    });

    it('should cleanup timer when cleanup() is called', () => {
      // GIVEN
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      // Simulate timer being set (accessing private property for test)
      gateway['shutdownTimer'] = setTimeout(() => {}, 10000) as NodeJS.Timeout;

      // WHEN
      gateway.cleanup();

      // THEN
      expect(gateway['shutdownTimer']).toBeUndefined();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'TIMER_CLEANUP',
        })
      );
    });

    it('should not throw error when cleanup() called with no active timer', () => {
      // GIVEN - no timer set
      
      // WHEN & THEN - should not throw
      expect(() => gateway.cleanup()).not.toThrow();
    });

    it('should integrate with NestJS lifecycle via onApplicationShutdown', async () => {
      // GIVEN
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');

      // Mock gracefulShutdown to avoid waiting 5s default timeout
      // Access via type assertion since it's protected in BaseSocketGateway
      const gracefulShutdownMock = jest.fn().mockResolvedValue(undefined);
      (gateway as any).gracefulShutdown = gracefulShutdownMock;

      // Connect some clients
      const client1 = createAuthenticatedClient({ userId: 'user1' }) as Socket;
      const client2 = createAuthenticatedClient({ userId: 'user2' }) as Socket;
      gateway.handleConnection(client1);
      gateway.handleConnection(client2);

      // WHEN - NestJS calls lifecycle hook
      await gateway.onApplicationShutdown('SIGTERM');

      // THEN - should log shutdown event (BaseSocketGateway uses APPLICATION_SHUTDOWN)
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'APPLICATION_SHUTDOWN',
          signal: 'SIGTERM',
        })
      );

      // THEN - should call gracefulShutdown (now in BaseSocketGateway)
      expect(gracefulShutdownMock).toHaveBeenCalledTimes(1);
    });
  });
});
