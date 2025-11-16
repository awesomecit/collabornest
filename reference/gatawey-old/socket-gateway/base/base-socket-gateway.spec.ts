/**
 * BaseSocketGateway Unit Tests
 * 
 * Comprehensive tests for the abstract BaseSocketGateway infrastructure class.
 * Tests verify:
 * - Disconnect reason categorization (moved from task1.2.3)
 * - handleDisconnect with enhanced logging
 * - Abstract hooks integration
 * - Connection pool management
 */

import { BaseSocketGateway } from './base-socket-gateway';
import { SocketGatewayConfigService } from '../socket-gateway-config.service';
import { DisconnectCategory } from '../socket-gateway.dto';
import { TypedSocket } from '../socket-gateway.types';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Helper function to verify logger calls with JSON stringified output
 * The logger now emits JSON.stringify() strings, so we need to parse and verify
 */
function expectLoggerCalledWithJson(
  loggerMethod: any,
  expectedFields: Record<string, any>,
  callIndex: number = 0,
): void {
  expect(loggerMethod).toHaveBeenCalled();
  const call = loggerMethod.mock.calls[callIndex];
  expect(call).toBeDefined();
  
  // Parse the JSON string argument
  const loggedString = call[0];
  const parsed = JSON.parse(loggedString);
  
  // Verify each expected field
  for (const [key, value] of Object.entries(expectedFields)) {
    expect(parsed).toHaveProperty(key);
    if (value !== expect.anything() && value !== expect.any(String) && value !== expect.any(Number)) {
      expect(parsed[key]).toEqual(value);
    }
  }
}

/**
 * Concrete implementation of BaseSocketGateway for testing
 * Minimal implementation to test abstract class behavior
 */
class TestSocketGateway extends BaseSocketGateway {
  // Track hook calls for verification
  public onClientAuthenticatedCalled = false;
  public onClientDisconnectingCalled = false;
  public lastAuthenticatedClient: TypedSocket | null = null;
  public lastDisconnectingClient: TypedSocket | null = null;

  constructor(configService: SocketGatewayConfigService, loggerContext?: string) {
    super(configService, loggerContext || 'TestSocketGateway');
  }

  protected onClientAuthenticated(client: TypedSocket): void {
    this.onClientAuthenticatedCalled = true;
    this.lastAuthenticatedClient = client;
  }

  protected onClientDisconnecting(client: TypedSocket): void {
    this.onClientDisconnectingCalled = true;
    this.lastDisconnectingClient = client;
  }

  // Expose protected methods for testing
  public exposedGetUserConnections(userId: string): string[] {
    return this.getUserConnections(userId);
  }
}

describe('BaseSocketGateway - Comprehensive Tests', () => {
  let gateway: TestSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;
  let mockServer: jest.Mocked<Server>;
  let mockLogger: jest.Mocked<Logger>;

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

  const createMockClient = (socketId: string, overrides?: Partial<TypedSocket>): Partial<TypedSocket> => {
    return {
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
      join: jest.fn(),
      leave: jest.fn(),
      conn: {
        transport: { name: 'websocket' },
      } as any,
      ...overrides,
    };
  };

  beforeEach(() => {
    // Create mock config service
    mockConfigService = {
      isEnabled: jest.fn().mockReturnValue(true),
      getPort: jest.fn().mockReturnValue(3000),
      getNamespace: jest.fn().mockReturnValue('/test'),
      getCorsConfig: jest.fn().mockReturnValue({ origin: '*' }),
      getTransports: jest.fn().mockReturnValue(['websocket']),
      getPingInterval: jest.fn().mockReturnValue(25000),
      getPingTimeout: jest.fn().mockReturnValue(20000),
      logClientConnected: jest.fn(),
      logClientDisconnected: jest.fn(),
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(999),
    } as any;

    // Create gateway manually (bypass NestJS DI for abstract class testing)
    gateway = new TestSocketGateway(mockConfigService);

    // Mock server
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      engine: {
        opts: {},
      },
      sockets: {
        sockets: new Map(),
      },
    } as any;

    gateway['server'] = mockServer;

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    // Override readonly logger property
    Object.defineProperty(gateway, 'logger', {
      value: mockLogger,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // GROUP 1: Disconnect Reason Categorization (moved from task1.2.3)
  // ============================================================================
  describe('Group 1: Disconnect Reason Categorization', () => {
    it('should categorize unknown disconnect reason correctly', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt: Date.now(), ipAddress: '', userAgent: '' },
      };

      // Call handleDisconnect which internally categorizes
      gateway.handleDisconnect(client);

      // Verify warn log was called with UNKNOWN category (since reason is 'unknown')
      expectLoggerCalledWithJson(mockLogger.warn, {
        event: '[WebSocket] CLIENT_DISCONNECTED',
        disconnectCategory: DisconnectCategory.UNKNOWN,
        disconnectReason: 'unknown',
        userId: 'user1',
        username: 'test',
      });
    });

    it('should use warn log level for UNKNOWN disconnect reasons', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt: Date.now(), ipAddress: '', userAgent: '' },
      };

      gateway.handleDisconnect(client);

      // UNKNOWN category should use warn level
      expectLoggerCalledWithJson(mockLogger.warn, {
        event: '[WebSocket] CLIENT_DISCONNECTED',
        disconnectCategory: DisconnectCategory.UNKNOWN,
        disconnectReason: 'unknown',
        userId: 'user1',
        username: 'test',
      });
    });

    it('should handle missing user data gracefully', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {}; // No user data

      expect(() => gateway.handleDisconnect(client)).not.toThrow();

      expectLoggerCalledWithJson(mockLogger.warn, {
        event: '[WebSocket] CLIENT_DISCONNECTED',
        userId: 'unknown',
        username: 'unknown',
      });
    });
  });

  // ============================================================================
  // GROUP 2: handleDisconnect Enhanced Logging
  // ============================================================================
  describe('Group 2: handleDisconnect Enhanced Logging', () => {
    it('should log session duration correctly', () => {
      const connectedAt = Date.now() - 120000; // 2 minutes ago
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt, ipAddress: '127.0.0.1', userAgent: 'test' },
      };

      gateway.handleDisconnect(client);

      // Verify sessionDuration is logged correctly (as "120001ms" and "2min")
      const logCall = mockLogger.warn.mock.calls[0][0];
      const parsed = JSON.parse(logCall);
      expect(parsed.sessionDuration).toMatch(/^\d+ms$/);
      expect(parsed.sessionDurationMinutes).toBe('2min');
    });

    it('should call onClientDisconnecting hook before cleanup', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt: Date.now(), ipAddress: '', userAgent: '' },
      };

      gateway.handleDisconnect(client);

      expect(gateway.onClientDisconnectingCalled).toBe(true);
      expect(gateway.lastDisconnectingClient).toBe(client);
    });

    it('should call removeAllListeners to prevent memory leaks', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt: Date.now(), ipAddress: '', userAgent: '' },
      };

      gateway.handleDisconnect(client);

      expect(client.removeAllListeners).toHaveBeenCalledTimes(1);
    });

    it('should skip processing if gateway is disabled', () => {
      mockConfigService.isEnabled.mockReturnValue(false);

      const client = createMockClient('socket-123') as TypedSocket;

      gateway.handleDisconnect(client);

      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(client.removeAllListeners).not.toHaveBeenCalled();
    });

    it('should remove connection from pool', () => {
      const client = createMockClient('socket-123') as TypedSocket;
      client.data = {
        user: { userId: 'user1', username: 'test', firstName: '', lastName: '', email: '', roles: [] },
        metadata: { connectedAt: Date.now(), ipAddress: '', userAgent: '' },
      };

      // Add to pool first (via handleConnection)
      gateway.handleConnection(client as any);
      expect(gateway['connectionPool'].has('socket-123')).toBe(true);

      // Disconnect should remove from pool
      gateway.handleDisconnect(client);
      expect(gateway['connectionPool'].has('socket-123')).toBe(false);
    });
  });

  // ============================================================================
  // GROUP 3: Authentication and handleConnection
  // ============================================================================
  describe('Group 3: Authentication and handleConnection', () => {
    it('should authenticate client and call onClientAuthenticated hook', () => {
      const client = createMockClient('socket-123') as TypedSocket;

      gateway.handleConnection(client as any);

      expect(gateway.onClientAuthenticatedCalled).toBe(true);
      expect(gateway.lastAuthenticatedClient).toBe(client);
    });

    it('should add connection to pool on successful authentication', () => {
      const client = createMockClient('socket-123') as TypedSocket;

      gateway.handleConnection(client as any);

      expect(gateway['connectionPool'].has('socket-123')).toBe(true);
      const conn = gateway['connectionPool'].get('socket-123');
      expect(conn).toMatchObject({
        socketId: 'socket-123',
        userId: 'user123',
        username: 'testuser',
        transport: 'websocket',
      });
    });

    it('should disconnect client if gateway is disabled', () => {
      mockConfigService.isEnabled.mockReturnValue(false);

      const client = createMockClient('socket-123') as TypedSocket;

      gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(gateway.onClientAuthenticatedCalled).toBe(false);
    });

    it('should disconnect client with invalid token', (done) => {
      const client = createMockClient('socket-123', {
        handshake: {
          auth: { token: 'invalid-token' },
          address: '127.0.0.1',
          headers: {},
          time: Date.now().toString(),
        } as any,
      }) as TypedSocket;

      gateway.handleConnection(client as any);

      // Verify authentication failure was logged immediately
      expectLoggerCalledWithJson(mockLogger.warn, {
        event: 'AUTH_FAILED',
        reason: 'INVALID_TOKEN',
      });

      // Disconnect happens after 100ms setTimeout, so we wait
      setTimeout(() => {
        expect(client.disconnect).toHaveBeenCalledWith(true);
        done();
      }, 150);
    });

    it('should disconnect client with missing token', (done) => {
      const client = createMockClient('socket-123', {
        handshake: {
          auth: {},
          address: '127.0.0.1',
          headers: {},
          time: Date.now().toString(),
        } as any,
      }) as TypedSocket;

      gateway.handleConnection(client as any);

      // Verify authentication failure was logged immediately
      expectLoggerCalledWithJson(mockLogger.warn, {
        event: 'AUTH_FAILED',
        reason: 'MISSING_TOKEN',
      });

      // Disconnect happens after 100ms setTimeout, so we wait
      setTimeout(() => {
        expect(client.disconnect).toHaveBeenCalledWith(true);
        done();
      }, 150);
    });
  });

  // ============================================================================
  // GROUP 4: Connection Pool Management
  // ============================================================================
  describe('Group 4: Connection Pool Management', () => {
    it('should track multiple connections for same user', () => {
      const client1 = createMockClient('socket-1') as TypedSocket;
      const client2 = createMockClient('socket-2') as TypedSocket;

      gateway.handleConnection(client1 as any);
      gateway.handleConnection(client2 as any);

      const userConnections = gateway.exposedGetUserConnections('user123');
      expect(userConnections).toHaveLength(2);
      expect(userConnections).toContain('socket-1');
      expect(userConnections).toContain('socket-2');
    });

    it('should enforce max connections per user', () => {
      mockConfigService.getMaxConnectionsPerUser.mockReturnValue(2);

      const client1 = createMockClient('socket-1') as TypedSocket;
      const client2 = createMockClient('socket-2') as TypedSocket;
      const client3 = createMockClient('socket-3') as TypedSocket;

      gateway.handleConnection(client1 as any);
      gateway.handleConnection(client2 as any);
      gateway.handleConnection(client3 as any); // Should be rejected

      expect(client3.disconnect).toHaveBeenCalledWith(true);
      expect(client3.emit).toHaveBeenCalledWith(
        'connection:rejected',
        expect.objectContaining({
          reason: 'MAX_CONNECTIONS_EXCEEDED',
        })
      );
    });
  });

  // ============================================================================
  // GROUP 5: Lifecycle Hooks
  // ============================================================================
  describe('Group 5: Lifecycle Hooks', () => {
    it('should initialize server correctly in afterInit', () => {
      const logSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.afterInit(mockServer as any);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('WebSocket Gateway initialized'));
    });

    it('should not initialize if gateway is disabled', () => {
      mockConfigService.isEnabled.mockReturnValue(false);

      const warnSpy = jest.spyOn(gateway['logger'], 'warn');

      gateway.afterInit(mockServer as any);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Socket Gateway is DISABLED')
      );
    });
  });

  // ============================================================================
  // GROUP 6: Graceful Shutdown
  // ============================================================================
  describe('Group 6: Graceful Shutdown', () => {
    it('should call gracefulShutdown on application shutdown', async () => {
      const gracefulShutdownSpy = jest.spyOn(gateway as any, 'gracefulShutdown').mockResolvedValue(undefined);

      await gateway.onApplicationShutdown('SIGTERM');

      expectLoggerCalledWithJson(mockLogger.log, {
        event: 'APPLICATION_SHUTDOWN',
        signal: 'SIGTERM',
      });
      expect(gracefulShutdownSpy).toHaveBeenCalledTimes(1);
    });
  });
});
