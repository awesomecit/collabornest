import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import { WsEvent } from './constants';
import { WebSocketGateway } from './websocket-gateway.gateway';

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

    return {
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
  };

  beforeEach(async () => {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        {
          provide: WebSocketGatewayConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    configService = module.get<WebSocketGatewayConfigService>(
      WebSocketGatewayConfigService,
    );

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
      gateway.handleDisconnect(mockClient);

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
      gateway.handleDisconnect(clients[0] as Socket);

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
});
