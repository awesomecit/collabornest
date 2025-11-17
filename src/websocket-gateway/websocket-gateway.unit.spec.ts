import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { JwtMockService } from './auth/jwt-mock.service';
import { ValidatedUser } from './auth/jwt-payload.interface';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import { WsEvent } from './constants';
import { WebSocketGateway } from './websocket-gateway.gateway';
import { RedisLockService } from './services/redis-lock.service';

/**
 * BE-001.1: WebSocket Connection Management - Unit Tests
 *
 * TASK: Test connection pool logic, JWT validation, max connections enforcement
 * Epic: EPIC-001-websocket-gateway.md
 *
 * Test Strategy: Unit tests (no real Socket.IO server)
 * - Mock Socket instances
 * - Test handleConnection/handleDisconnect logic directly
 * - Verify connection pool mutations
 *
 * Test Runner: Jest
 * Framework: NestJS Testing Module
 */

describe('WebSocketGateway - BE-001.1 Unit Tests', () => {
  let gateway: WebSocketGateway;
  let configService: WebSocketGatewayConfigService;

  // Mock client counter
  let mockClientIdCounter = 0;

  // Helper: Create mock Socket.IO client
  const createMockSocket = (
    userId: string,
    token?: string,
  ): Partial<Socket> => {
    const socketId = `socket-${++mockClientIdCounter}`;
    const jwtToken =
      token ||
      `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({
          sub: userId,
          preferred_username: `user_${userId}`,
          email: `${userId}@example.com`,
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64')}.signature`;

    const mockSocket: Partial<Socket> = {
      id: socketId,
      handshake: {
        auth: { token: jwtToken },
        address: '127.0.0.1',
        headers: { 'user-agent': 'test-client' },
      } as any,
      conn: {
        transport: { name: 'websocket' },
      } as any,
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    // Add socket to server's socket map for forceDisconnect to find
    if (gateway && gateway.server) {
      gateway.server.sockets.sockets.set(socketId, mockSocket as Socket);
    }

    return mockSocket;
  };

  beforeEach(async () => {
    // Mock Socket.IO server
    const mockServer = {
      emit: jest.fn(),
      use: jest.fn((middleware: any) => {
        // Store middleware for testing if needed
        return mockServer;
      }),
      sockets: {
        sockets: new Map(),
      },
      engine: {
        opts: {
          pingInterval: undefined,
          pingTimeout: undefined,
        },
      },
    };

    const mockConfigService = {
      getPort: jest.fn().mockReturnValue(3001),
      getNamespace: jest.fn().mockReturnValue('/collaboration'),
      getPingInterval: jest.fn().mockReturnValue(25000),
      getPingTimeout: jest.fn().mockReturnValue(20000),
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(5),
      isEnabled: jest.fn().mockReturnValue(true),
      getCorsConfig: jest
        .fn()
        .mockReturnValue({ origin: '*', credentials: true }),
      getTransports: jest.fn().mockReturnValue(['websocket', 'polling']),
    };

    const mockJwtService = {
      validateToken: jest
        .fn()
        .mockImplementation(async (token: string): Promise<ValidatedUser> => {
          // Parse mock JWT token
          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
          }

          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf8'),
          );

          // Check expiration
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            throw new Error('JWT expired');
          }

          return {
            userId: payload.sub,
            username: payload.preferred_username,
            email: payload.email,
            fullName: undefined,
            roles: [],
            payload,
          };
        }),
    };

    // Mock RedisLockService (unit test doesn't need real Redis)
    const mockLockService = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
      extendLock: jest.fn().mockResolvedValue(true),
      releaseAllUserLocks: jest.fn().mockResolvedValue(undefined),
      getLockHolder: jest.fn().mockResolvedValue(null), // No lock holder by default
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        {
          provide: WebSocketGatewayConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtMockService,
          useValue: mockJwtService,
        },
        {
          provide: RedisLockService,
          useValue: mockLockService,
        },
      ],
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    configService = module.get<WebSocketGatewayConfigService>(
      WebSocketGatewayConfigService,
    );

    // Inject mock server
    gateway.server = mockServer as any;

    // Reset mock counter
    mockClientIdCounter = 0;
  });

  describe('Connection Pool Tracking', () => {
    it('should add connection to pool on handleConnection', async () => {
      // GIVEN
      const mockClient = createMockSocket('user123') as Socket;

      console.log('[DEBUG][WS][Unit] Testing connection pool add:', {
        socketId: mockClient.id,
        userId: 'user123',
      });

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      expect(gateway.getConnectionPoolSize()).toBe(1);
      expect(gateway.hasConnection(mockClient.id!)).toBe(true);

      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo!.userId).toBe('user123');
      expect(connectionInfo!.username).toBe('user_user123');
      expect(connectionInfo!.email).toBe('user123@example.com');

      console.log('[DEBUG][WS][Unit] Connection info:', connectionInfo);
    });

    it('should remove connection from pool on handleDisconnect', async () => {
      // GIVEN a connected client
      const mockClient = createMockSocket('user456') as Socket;
      await gateway.handleConnection(mockClient);

      console.log('[DEBUG][WS][Unit] Testing connection pool removal:', {
        socketId: mockClient.id,
        initialPoolSize: gateway.getConnectionPoolSize(),
      });

      // WHEN
      await gateway.handleDisconnect(mockClient);

      // THEN
      expect(gateway.getConnectionPoolSize()).toBe(0);
      expect(gateway.hasConnection(mockClient.id!)).toBe(false);

      console.log(
        '[DEBUG][WS][Unit] Pool size after disconnect:',
        gateway.getConnectionPoolSize(),
      );
    });

    it('should track multiple connections per user', async () => {
      // GIVEN
      const client1 = createMockSocket('multi-user') as Socket;
      const client2 = createMockSocket('multi-user') as Socket;

      console.log(
        '[DEBUG][WS][Unit] Testing multiple connections for same user',
      );

      // WHEN
      await gateway.handleConnection(client1);
      await gateway.handleConnection(client2);

      // THEN
      const userConnections = gateway.getConnectionsByUserId('multi-user');
      expect(userConnections.length).toBe(2);
      expect(gateway.getConnectionPoolSize()).toBe(2);

      console.log('[DEBUG][WS][Unit] User connections:', {
        userId: 'multi-user',
        connectionCount: userConnections.length,
        socketIds: userConnections.map(c => c.socketId),
      });
    });
  });

  describe('JWT Token Validation', () => {
    it('should accept valid JWT token', async () => {
      // GIVEN
      const mockClient = createMockSocket('valid-user') as Socket;

      console.log('[DEBUG][WS][Unit] Testing valid JWT token acceptance');

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect(gateway.hasConnection(mockClient.id!)).toBe(true);
      expect(mockClient.emit).toHaveBeenCalledWith(
        WsEvent.CONNECTED,
        expect.objectContaining({
          socketId: mockClient.id,
          userId: 'valid-user',
        }),
      );

      console.log('[DEBUG][WS][Unit] Valid JWT accepted successfully');
    });

    it('should reject expired JWT token', async () => {
      // GIVEN an expired token
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({
          sub: 'expired-user',
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1h ago
        }),
      ).toString('base64')}.signature`;

      const mockClient = createMockSocket(
        'expired-user',
        expiredToken,
      ) as Socket;

      console.log('[DEBUG][WS][Unit] Testing expired JWT token rejection');

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.hasConnection(mockClient.id!)).toBe(false);
      // Note: No emit check - 'connect_error' is reserved by Socket.IO

      console.log('[DEBUG][WS][Unit] Expired JWT rejected successfully');
    });

    it('should reject missing JWT token', async () => {
      // GIVEN a client without token
      const mockClient = createMockSocket('no-token', '') as Socket;
      mockClient.handshake!.auth = {}; // No token

      console.log('[DEBUG][WS][Unit] Testing missing JWT token rejection');

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.hasConnection(mockClient.id!)).toBe(false);
      // Note: No emit check - 'connect_error' is reserved by Socket.IO

      console.log('[DEBUG][WS][Unit] Missing JWT rejected successfully');
    });
  });

  describe('Max Connections Per User Enforcement', () => {
    it('should allow up to max connections per user', async () => {
      // GIVEN max connections = 5
      const maxConnections = configService.getMaxConnectionsPerUser();
      const clients: Partial<Socket>[] = [];

      console.log('[DEBUG][WS][Unit] Testing max connections enforcement:', {
        maxConnections,
      });

      // WHEN creating max allowed connections
      for (let i = 0; i < maxConnections; i++) {
        const client = createMockSocket('max-conn-user') as Socket;
        clients.push(client);
        await gateway.handleConnection(client);
      }

      // THEN all should be accepted
      expect(gateway.getConnectionsByUserId('max-conn-user').length).toBe(
        maxConnections,
      );

      console.log(
        '[DEBUG][WS][Unit] All max connections accepted:',
        maxConnections,
      );
    });

    it('should reject connection when max limit exceeded', async () => {
      // GIVEN user already has max connections
      const maxConnections = configService.getMaxConnectionsPerUser();

      for (let i = 0; i < maxConnections; i++) {
        const client = createMockSocket('limit-user') as Socket;
        await gateway.handleConnection(client);
      }

      console.log(
        '[DEBUG][WS][Unit] Testing rejection when max limit exceeded',
      );

      // WHEN attempting one more connection
      const extraClient = createMockSocket('limit-user') as Socket;
      await gateway.handleConnection(extraClient);

      // THEN extra connection should be rejected
      expect(extraClient.disconnect).toHaveBeenCalledWith(true);
      // Note: No emit check - 'connect_error' is reserved by Socket.IO
      expect(gateway.getConnectionsByUserId('limit-user').length).toBe(
        maxConnections,
      );

      console.log('[DEBUG][WS][Unit] Extra connection rejected successfully');
    });

    it('should allow new connection after disconnect', async () => {
      // GIVEN user at max connections
      const maxConnections = configService.getMaxConnectionsPerUser();
      const clients: Partial<Socket>[] = [];

      for (let i = 0; i < maxConnections; i++) {
        const client = createMockSocket('disconnect-user') as Socket;
        clients.push(client);
        await gateway.handleConnection(client);
      }

      console.log(
        '[DEBUG][WS][Unit] Testing connection slot reuse after disconnect',
      );

      // WHEN one client disconnects
      await gateway.handleDisconnect(clients[0] as Socket);

      // THEN new connection should be allowed
      const newClient = createMockSocket('disconnect-user') as Socket;
      await gateway.handleConnection(newClient);

      expect(gateway.getConnectionsByUserId('disconnect-user').length).toBe(
        maxConnections,
      );
      expect(newClient.disconnect).not.toHaveBeenCalled();

      console.log('[DEBUG][WS][Unit] New connection accepted after disconnect');
    });
  });

  describe('Connection Metadata Tracking', () => {
    it('should track transport type', async () => {
      // GIVEN a WebSocket client
      const mockClient = createMockSocket('transport-user') as Socket;
      // Transport type is already set in createMockSocket

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      expect(connectionInfo!.transport).toBe('websocket');
    });

    it('should track IP address and user agent', async () => {
      // GIVEN a client with IP and user-agent
      const mockClient = createMockSocket('metadata-user') as Socket;
      mockClient.handshake!.address = '192.168.1.100';
      mockClient.handshake!.headers = { 'user-agent': 'Mozilla/5.0' };

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      expect(connectionInfo!.ipAddress).toBe('192.168.1.100');
      expect(connectionInfo!.userAgent).toBe('Mozilla/5.0');
    });

    it('should track connection timestamps', async () => {
      // GIVEN
      const beforeConnect = new Date().toISOString();
      const mockClient = createMockSocket('timestamp-user') as Socket;

      // WHEN
      await gateway.handleConnection(mockClient);

      // THEN
      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      expect(connectionInfo!.connectedAt).toBeDefined();
      expect(connectionInfo!.lastActivityAt).toBeDefined();
      expect(
        new Date(connectionInfo!.connectedAt).getTime(),
      ).toBeGreaterThanOrEqual(new Date(beforeConnect).getTime());
    });
  });

  // ==============================================================================
  // BE-001.1 Step 4: Connection Pool Advanced Management
  // ==============================================================================

  describe('Pool Statistics (Step 4.2)', () => {
    it('should provide total connections count', async () => {
      // GIVEN - Connect 3 users
      const clients: Socket[] = [];
      for (let i = 1; i <= 3; i++) {
        const client = createMockSocket(`stats-user-${i}`) as Socket;
        await gateway.handleConnection(client);
        clients.push(client);
      }

      // WHEN
      const stats = gateway.getPoolStats();

      // THEN
      expect(stats.totalConnections).toBe(3);
    });

    it('should provide unique users count', async () => {
      // GIVEN - User1 has 2 connections, User2 has 1 connection
      const user1client1 = createMockSocket('multi-user') as Socket;
      const user1client2 = createMockSocket('multi-user') as Socket;
      const user2client1 = createMockSocket('single-user') as Socket;

      await gateway.handleConnection(user1client1);
      await gateway.handleConnection(user1client2);
      await gateway.handleConnection(user2client1);

      // WHEN
      const stats = gateway.getPoolStats();

      // THEN
      expect(stats.totalConnections).toBe(3);
      expect(stats.uniqueUsers).toBe(2);
    });

    it('should provide connections by transport type', async () => {
      // GIVEN - 2 websocket, 1 polling
      const wsClient1 = createMockSocket('ws-user-1') as Socket;
      const wsClient2 = createMockSocket('ws-user-2') as Socket;
      const pollingClient = createMockSocket('polling-user') as Socket;
      // Override transport type for test
      (pollingClient.conn as any).transport = { name: 'polling' };

      await gateway.handleConnection(wsClient1);
      await gateway.handleConnection(wsClient2);
      await gateway.handleConnection(pollingClient);

      // WHEN
      const stats = gateway.getPoolStats();

      // THEN
      expect(stats.byTransport.websocket).toBe(2);
      expect(stats.byTransport.polling).toBe(1);
    });

    it('should detect stale connections based on lastActivityAt', async () => {
      // GIVEN - Connect user and manually modify lastActivityAt to simulate staleness
      const mockClient = createMockSocket('stale-user') as Socket;
      await gateway.handleConnection(mockClient);

      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      const staleTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      connectionInfo!.lastActivityAt = staleTimestamp;

      // WHEN
      const stats = gateway.getPoolStats();

      // THEN
      expect(stats.staleConnections).toBe(1);
    });
  });

  describe('Admin Force Disconnect (Step 4.3)', () => {
    it('should force disconnect a single connection by socketId', async () => {
      // GIVEN
      const mockClient = createMockSocket('force-user') as Socket;
      await gateway.handleConnection(mockClient);

      expect(gateway.getConnectionPoolSize()).toBe(1);

      // WHEN
      gateway.forceDisconnect(mockClient.id!);

      // THEN
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });

    it('should disconnect all connections for a specific user', async () => {
      // GIVEN - User has 3 connections
      const clients: Socket[] = [];
      for (let i = 1; i <= 3; i++) {
        const client = createMockSocket('multi-conn-user') as Socket;
        await gateway.handleConnection(client);
        clients.push(client);
      }

      expect(gateway.getConnectionPoolSize()).toBe(3);

      // WHEN
      const disconnectedCount = gateway.disconnectUser('multi-conn-user');

      // THEN
      expect(disconnectedCount).toBe(3);
      expect(gateway.getConnectionPoolSize()).toBe(0);
      clients.forEach((client: Socket) => {
        expect(client.disconnect).toHaveBeenCalledWith(true);
      });
    });

    it('should return 0 when disconnecting non-existent user', () => {
      // GIVEN - no connections

      // WHEN
      const count = gateway.disconnectUser('ghost-user');

      // THEN
      expect(count).toBe(0);
    });
  });

  describe('Stale Connection Cleanup (Step 4.1)', () => {
    it('should detect and cleanup stale connections after inactivity threshold', async () => {
      // GIVEN - Connect user with stale lastActivityAt
      const mockClient = createMockSocket('stale-cleanup-user') as Socket;
      await gateway.handleConnection(mockClient);

      const connectionInfo = gateway.getConnectionInfo(mockClient.id!);
      const staleTimestamp = new Date(
        Date.now() - 10 * 60 * 1000,
      ).toISOString(); // 10 minutes ago
      connectionInfo!.lastActivityAt = staleTimestamp;

      // WHEN
      const cleanedUp = gateway.cleanupStaleConnections();

      // THEN
      expect(cleanedUp).toBe(1);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });

    it('should not cleanup active connections', async () => {
      // GIVEN - Connect user with recent activity
      const mockClient = createMockSocket('active-user') as Socket;
      await gateway.handleConnection(mockClient);

      // lastActivityAt is set to now by default in handleConnection

      // WHEN
      const cleanedUp = gateway.cleanupStaleConnections();

      // THEN
      expect(cleanedUp).toBe(0);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect(gateway.getConnectionPoolSize()).toBe(1);
    });

    it('should cleanup only stale connections and keep active ones', async () => {
      // GIVEN - 1 stale, 2 active
      const staleClient = createMockSocket('stale-user') as Socket;
      const activeClient1 = createMockSocket('active-user-1') as Socket;
      const activeClient2 = createMockSocket('active-user-2') as Socket;

      await gateway.handleConnection(staleClient);
      await gateway.handleConnection(activeClient1);
      await gateway.handleConnection(activeClient2);

      // Make first connection stale
      const staleInfo = gateway.getConnectionInfo(staleClient.id!);
      staleInfo!.lastActivityAt = new Date(
        Date.now() - 10 * 60 * 1000,
      ).toISOString();

      // WHEN
      const cleanedUp = gateway.cleanupStaleConnections();

      // THEN
      expect(cleanedUp).toBe(1);
      expect(staleClient.disconnect).toHaveBeenCalledWith(true);
      expect(activeClient1.disconnect).not.toHaveBeenCalled();
      expect(activeClient2.disconnect).not.toHaveBeenCalled();
      expect(gateway.getConnectionPoolSize()).toBe(2);
    });
  });

  describe('Graceful Shutdown (Step 4.5)', () => {
    it('should notify all clients before shutdown', async () => {
      // GIVEN - Connect 3 clients and mock server.emit
      const mockServerEmit = jest.fn();
      gateway.server.emit = mockServerEmit;

      const clients: Socket[] = [];
      for (let i = 1; i <= 3; i++) {
        const client = createMockSocket(`shutdown-user-${i}`) as Socket;
        await gateway.handleConnection(client);
        clients.push(client);
      }

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN - Server should broadcast shutdown notification
      expect(mockServerEmit).toHaveBeenCalledWith(
        WsEvent.SERVER_SHUTDOWN,
        expect.objectContaining({
          message: expect.any(String),
          timestamp: expect.any(String),
        }),
      );
    });

    it('should force disconnect remaining clients after timeout', async () => {
      // GIVEN
      const client = createMockSocket('stubborn-client') as Socket;
      await gateway.handleConnection(client);

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });

    it('should clear connection pool after shutdown', async () => {
      // GIVEN
      const clients: Socket[] = [];
      for (let i = 1; i <= 3; i++) {
        const client = createMockSocket(`pool-clear-user-${i}`) as Socket;
        await gateway.handleConnection(client);
        clients.push(client);
      }

      expect(gateway.getConnectionPoolSize()).toBe(3);

      // WHEN
      await gateway.gracefulShutdown({ timeout: 100 });

      // THEN
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });

    it('should integrate with NestJS lifecycle (onApplicationShutdown)', async () => {
      // GIVEN
      const client = createMockSocket('lifecycle-user') as Socket;
      await gateway.handleConnection(client);

      const gracefulShutdownSpy = jest.spyOn(
        gateway as any,
        'gracefulShutdown',
      );

      // WHEN - NestJS calls lifecycle hook
      await gateway.onApplicationShutdown('SIGTERM');

      // THEN
      expect(gracefulShutdownSpy).toHaveBeenCalled();
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });
  });

  describe('Memory Leak Prevention (Step 4.4)', () => {
    it('should remove connection from pool on disconnect', async () => {
      // GIVEN
      const client = createMockSocket('leak-test-user') as Socket;
      await gateway.handleConnection(client);

      expect(gateway.hasConnection(client.id!)).toBe(true);
      expect(gateway.getConnectionPoolSize()).toBe(1);

      // WHEN
      await gateway.handleDisconnect(client);

      // THEN - Connection should be removed from both maps
      expect(gateway.hasConnection(client.id!)).toBe(false);
      expect(gateway.getConnectionPoolSize()).toBe(0);
      expect(gateway.getConnectionsByUserId('leak-test-user')).toHaveLength(0);
    });

    it('should cleanup user index when all user connections are closed', async () => {
      // GIVEN - User has 2 connections
      const client1 = createMockSocket('leak-user') as Socket;
      const client2 = createMockSocket('leak-user') as Socket;

      await gateway.handleConnection(client1);
      await gateway.handleConnection(client2);

      expect(gateway.getConnectionsByUserId('leak-user')).toHaveLength(2);

      // WHEN - Close both connections
      await gateway.handleDisconnect(client1);
      await gateway.handleDisconnect(client2);

      // THEN - User should be removed from index
      expect(gateway.getConnectionsByUserId('leak-user')).toHaveLength(0);
      expect(gateway.getConnectionPoolSize()).toBe(0);
    });

    it('should not leak memory when forceDisconnect is used', async () => {
      // GIVEN
      const client = createMockSocket('force-leak-user') as Socket;
      await gateway.handleConnection(client);

      expect(gateway.getConnectionPoolSize()).toBe(1);

      // WHEN
      gateway.forceDisconnect(client.id!);

      // THEN - Should cleanup both connectionPool and userConnections
      expect(gateway.getConnectionPoolSize()).toBe(0);
      expect(gateway.getConnectionsByUserId('force-leak-user')).toHaveLength(0);
    });
  });

  /**
   * STEP 5: Transport-Level Ping/Pong Configuration
   *
   * BDD: Socket.IO engine configured with pingInterval and pingTimeout for zombie detection
   * - afterInit() sets server.engine.opts.pingInterval from config (default 25s)
   * - afterInit() sets server.engine.opts.pingTimeout from config (default 20s)
   * - Falls back to defaults if config returns undefined
   */
  describe('Step 5: Transport-Level Ping/Pong Configuration', () => {
    it('should configure Socket.IO engine with custom ping interval and timeout', () => {
      // GIVEN - Config service returns custom values
      const customPingInterval = 15000; // 15s
      const customPingTimeout = 10000; // 10s
      jest
        .spyOn(configService, 'getPingInterval')
        .mockReturnValue(customPingInterval);
      jest
        .spyOn(configService, 'getPingTimeout')
        .mockReturnValue(customPingTimeout);

      // WHEN - afterInit is called
      gateway.afterInit(gateway.server);

      // THEN - Engine options should be configured
      expect(gateway.server.engine.opts.pingInterval).toBe(customPingInterval);
      expect(gateway.server.engine.opts.pingTimeout).toBe(customPingTimeout);
    });

    it('should use default ping values if config returns undefined', () => {
      // GIVEN - Config service returns undefined (use defaults)
      jest
        .spyOn(configService, 'getPingInterval')
        .mockReturnValue(undefined as any);
      jest
        .spyOn(configService, 'getPingTimeout')
        .mockReturnValue(undefined as any);

      // WHEN - afterInit is called
      gateway.afterInit(gateway.server);

      // THEN - Should fall back to Socket.IO defaults
      expect(gateway.server.engine.opts.pingInterval).toBe(25000); // Default 25s
      expect(gateway.server.engine.opts.pingTimeout).toBe(20000); // Default 20s
    });
  });

  /**
   * BE-001.2: Presence Tracking & Resource Rooms - Unit Tests
   *
   * Test Strategy: Unit tests for presence tracking logic
   * - Test handleJoinResource: valid join, duplicate join, invalid mode
   * - Test handleLeaveResource: valid leave, not joined error
   * - Test multi-resource support: user in multiple resources
   * - Test disconnect cleanup: user removed from all resources
   */
  describe('BE-001.2: Presence Tracking & Resource Rooms', () => {
    describe('handleJoinResource', () => {
      it('should add user to resource and return success', async () => {
        // GIVEN - Connected client
        const mockClient = createMockSocket('user123') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);

        // WHEN - Join resource
        const result = await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/123',
          resourceType: 'page',
          mode: 'editor',
        });

        // THEN - Success response
        expect(result.event).toBe('resource:joined');
        expect(result.data.success).toBe(true);
        expect(result.data.resourceId).toBe('resource:page:/patient/123');
        expect(result.data.userId).toBe('user123');
        expect(result.data.users).toHaveLength(1);
        expect(result.data.users[0].userId).toBe('user123');
        expect(result.data.users[0].mode).toBe('editor');
        expect(mockClient.join).toHaveBeenCalledWith(
          'resource:page:/patient/123',
        );
      });

      it('should reject duplicate join with error', async () => {
        // GIVEN - User already in resource
        const mockClient = createMockSocket('user456') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/456',
          resourceType: 'page',
          mode: 'viewer',
        });

        // WHEN - Try to join same resource again
        const result = await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/456',
          resourceType: 'page',
          mode: 'editor',
        });

        // THEN - Error response
        expect(result.data.success).toBe(false);
        expect(result.data.message).toContain('already joined');
      });

      it('should support multiple resources per user', async () => {
        // GIVEN - Connected client
        const mockClient = createMockSocket('user789') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);

        // WHEN - Join two different resources
        const result1 = await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/111',
          resourceType: 'page',
          mode: 'editor',
        });
        const result2 = await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/222',
          resourceType: 'page',
          mode: 'viewer',
        });

        // THEN - Both joins succeed
        expect(result1.data.success).toBe(true);
        expect(result2.data.success).toBe(true);
        expect(mockClient.join).toHaveBeenCalledTimes(2);
      });

      it('should broadcast user:joined to other users', async () => {
        // GIVEN - Two connected clients in same resource
        const client1 = createMockSocket('user1') as Socket;
        const client2 = createMockSocket('user2') as Socket;
        client1.join = jest.fn().mockResolvedValue(undefined);
        client2.join = jest.fn().mockResolvedValue(undefined);
        const mockEmit = jest.fn();
        client1.to = jest.fn().mockReturnValue({ emit: mockEmit });
        client2.to = jest.fn().mockReturnValue({ emit: mockEmit });

        await gateway.handleConnection(client1);
        await gateway.handleConnection(client2);
        await gateway.handleJoinResource(client1, {
          resourceId: 'resource:page:/patient/999',
          resourceType: 'page',
          mode: 'editor',
        });

        // WHEN - Second user joins
        await gateway.handleJoinResource(client2, {
          resourceId: 'resource:page:/patient/999',
          resourceType: 'page',
          mode: 'viewer',
        });

        // THEN - user:joined broadcast sent
        expect(client2.to).toHaveBeenCalledWith('resource:page:/patient/999');
        expect(mockEmit).toHaveBeenCalledWith(
          'user:joined',
          expect.objectContaining({
            resourceId: 'resource:page:/patient/999',
            userId: 'user2',
            username: 'user_user2',
          }),
        );
      });

      it('should emit resource:all_users when joining a sub-resource', async () => {
        // GIVEN - Multiple users in different tabs of same document
        const client1 = createMockSocket('user1') as Socket;
        const client2 = createMockSocket('user2') as Socket;
        const client3 = createMockSocket('user3') as Socket;

        client1.join = jest.fn().mockResolvedValue(undefined);
        client2.join = jest.fn().mockResolvedValue(undefined);
        client3.join = jest.fn().mockResolvedValue(undefined);
        client1.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        client2.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        client3.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        client1.emit = jest.fn();
        client2.emit = jest.fn();
        client3.emit = jest.fn();

        await gateway.handleConnection(client1);
        await gateway.handleConnection(client2);
        await gateway.handleConnection(client3);

        // User1 joins tab:patient-info
        await gateway.handleJoinResource(client1, {
          resourceId: 'document:123/tab:patient-info',
          resourceType: 'document',
          mode: 'editor',
        });

        // User2 joins tab:diagnosis
        await gateway.handleJoinResource(client2, {
          resourceId: 'document:123/tab:diagnosis',
          resourceType: 'document',
          mode: 'viewer',
        });

        // WHEN - User3 joins tab:procedure
        await gateway.handleJoinResource(client3, {
          resourceId: 'document:123/tab:procedure',
          resourceType: 'document',
          mode: 'editor',
        });

        // THEN - Client3 receives resource:all_users with ALL users from ALL tabs
        expect(client3.emit).toHaveBeenCalledWith(
          'resource:all_users',
          expect.objectContaining({
            parentResourceId: 'document:123',
            currentSubResourceId: 'document:123/tab:procedure',
            totalCount: 3,
            subResources: expect.arrayContaining([
              expect.objectContaining({
                subResourceId: 'document:123/tab:patient-info',
                users: expect.arrayContaining([
                  expect.objectContaining({ userId: 'user1', mode: 'editor' }),
                ]),
              }),
              expect.objectContaining({
                subResourceId: 'document:123/tab:diagnosis',
                users: expect.arrayContaining([
                  expect.objectContaining({ userId: 'user2', mode: 'viewer' }),
                ]),
              }),
              expect.objectContaining({
                subResourceId: 'document:123/tab:procedure',
                users: expect.arrayContaining([
                  expect.objectContaining({ userId: 'user3', mode: 'editor' }),
                ]),
              }),
            ]),
          }),
        );
      });

      it('should NOT emit resource:all_users when joining a top-level resource', async () => {
        // GIVEN - Client joins top-level resource (no parent)
        const mockClient = createMockSocket('user999') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        mockClient.emit = jest.fn();
        await gateway.handleConnection(mockClient);

        // WHEN - Join top-level resource (no sub-resource)
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'document:456',
          resourceType: 'document',
          mode: 'editor',
        });

        // THEN - resource:all_users NOT emitted
        expect(mockClient.emit).not.toHaveBeenCalledWith(
          'resource:all_users',
          expect.anything(),
        );
      });

      it('should show only current tab users in resource:joined response', async () => {
        // GIVEN - User1 in tab:patient, User2 in tab:diagnosis
        const client1 = createMockSocket('user1') as Socket;
        const client2 = createMockSocket('user2') as Socket;

        client1.join = jest.fn().mockResolvedValue(undefined);
        client2.join = jest.fn().mockResolvedValue(undefined);
        client1.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        client2.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        client1.emit = jest.fn();
        client2.emit = jest.fn();

        await gateway.handleConnection(client1);
        await gateway.handleConnection(client2);

        await gateway.handleJoinResource(client1, {
          resourceId: 'document:789/tab:patient',
          resourceType: 'document',
          mode: 'editor',
        });

        // WHEN - User2 joins different tab
        const result = await gateway.handleJoinResource(client2, {
          resourceId: 'document:789/tab:diagnosis',
          resourceType: 'document',
          mode: 'viewer',
        });

        // THEN - resource:joined shows only users in CURRENT tab (user2)
        expect(result.data.users).toHaveLength(1);
        expect(result.data.users[0].userId).toBe('user2');

        // BUT resource:all_users was emitted showing ALL tabs
        expect(client2.emit).toHaveBeenCalledWith(
          'resource:all_users',
          expect.objectContaining({
            totalCount: 2, // Both users across all tabs
          }),
        );
      });
    });

    describe('handleLeaveResource', () => {
      it('should remove user from resource and return success', async () => {
        // GIVEN - User in resource
        const mockClient = createMockSocket('user555') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.leave = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/555',
          resourceType: 'page',
          mode: 'editor',
        });

        // WHEN - Leave resource
        const result = await gateway.handleLeaveResource(mockClient, {
          resourceId: 'resource:page:/patient/555',
        });

        // THEN - Success response
        expect(result.event).toBe('resource:left');
        expect(result.data.success).toBe(true);
        expect(result.data.resourceId).toBe('resource:page:/patient/555');
        expect(result.data.userId).toBe('user555');
        expect(mockClient.leave).toHaveBeenCalledWith(
          'resource:page:/patient/555',
        );
      });

      it('should reject leave if user not in resource', async () => {
        // GIVEN - User NOT in resource
        const mockClient = createMockSocket('user666') as Socket;
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);

        // WHEN - Try to leave
        const result = await gateway.handleLeaveResource(mockClient, {
          resourceId: 'resource:page:/patient/666',
        });

        // THEN - Error response
        expect(result.data.success).toBe(false);
        expect(result.data.message).toContain('not in this resource');
      });

      it('should broadcast user:left to other users', async () => {
        // GIVEN - Two users in same resource
        const client1 = createMockSocket('userA') as Socket;
        const client2 = createMockSocket('userB') as Socket;
        client1.join = jest.fn().mockResolvedValue(undefined);
        client2.join = jest.fn().mockResolvedValue(undefined);
        client1.leave = jest.fn().mockResolvedValue(undefined);
        const mockEmit = jest.fn();
        client1.to = jest.fn().mockReturnValue({ emit: mockEmit });
        client2.to = jest.fn().mockReturnValue({ emit: mockEmit });

        await gateway.handleConnection(client1);
        await gateway.handleConnection(client2);
        await gateway.handleJoinResource(client1, {
          resourceId: 'resource:page:/patient/AAA',
          resourceType: 'page',
          mode: 'editor',
        });
        await gateway.handleJoinResource(client2, {
          resourceId: 'resource:page:/patient/AAA',
          resourceType: 'page',
          mode: 'viewer',
        });

        // WHEN - First user leaves
        await gateway.handleLeaveResource(client1, {
          resourceId: 'resource:page:/patient/AAA',
        });

        // THEN - user:left broadcast sent
        expect(client1.to).toHaveBeenCalledWith('resource:page:/patient/AAA');
        expect(mockEmit).toHaveBeenCalledWith(
          'user:left',
          expect.objectContaining({
            resourceId: 'resource:page:/patient/AAA',
            userId: 'userA',
            username: 'user_userA',
          }),
        );
      });
    });

    describe('Disconnect Cleanup', () => {
      it('should remove user from all resources on disconnect', async () => {
        // GIVEN - User in multiple resources
        const mockClient = createMockSocket('user888') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        mockClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(mockClient);
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/R1',
          resourceType: 'page',
          mode: 'editor',
        });
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/R2',
          resourceType: 'page',
          mode: 'viewer',
        });

        // WHEN - Disconnect
        await gateway.handleDisconnect(mockClient);

        // THEN - User removed from all resources (verify via re-join attempt)
        const reconnectedClient = createMockSocket('user888') as Socket;
        reconnectedClient.join = jest.fn().mockResolvedValue(undefined);
        reconnectedClient.to = jest.fn().mockReturnValue({ emit: jest.fn() });
        await gateway.handleConnection(reconnectedClient);

        const result = await gateway.handleJoinResource(reconnectedClient, {
          resourceId: 'resource:page:/patient/R1',
          resourceType: 'page',
          mode: 'editor',
        });

        expect(result.data.success).toBe(true);
        expect(result.data.users).toHaveLength(1); // Only new connection
      });

      it('should broadcast user:left with disconnect reason', async () => {
        // GIVEN - User in resource
        const mockClient = createMockSocket('user999') as Socket;
        mockClient.join = jest.fn().mockResolvedValue(undefined);
        const mockEmit = jest.fn();
        mockClient.to = jest.fn().mockReturnValue({ emit: mockEmit });
        await gateway.handleConnection(mockClient);
        await gateway.handleJoinResource(mockClient, {
          resourceId: 'resource:page:/patient/disconnect-test',
          resourceType: 'page',
          mode: 'editor',
        });

        // WHEN - Disconnect
        await gateway.handleDisconnect(mockClient);

        // THEN - user:left with reason='user_disconnected'
        expect(mockClient.to).toHaveBeenCalledWith(
          'resource:page:/patient/disconnect-test',
        );
        expect(mockEmit).toHaveBeenCalledWith(
          'user:left',
          expect.objectContaining({
            userId: 'user999',
            reason: 'user_disconnected',
          }),
        );
      });
    });
  });
});
