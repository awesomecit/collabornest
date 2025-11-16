import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

describe('CollaborationSocketGateway - Task 1.2.4 - JWT Authentication & User Extraction', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: Partial<SocketGatewayConfigService>;
  let mockLogger: Partial<Logger>;
  let mockServer: Partial<Server>;

  beforeEach(async () => {
    // Use centralized mocks (DRY principle)
    mockConfigService = createMockConfigService();
    mockConfigService.getMaxConnectionsPerUser = jest.fn().mockReturnValue(999); // High limit for tests

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock Server
    mockServer = {
      engine: {
        opts: {},
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationSocketGateway,
        {
          provide: SocketGatewayConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SurgeryManagementService,
          useValue: createMockSurgeryService(),
        },
      ],
    }).compile();

    gateway = module.get<CollaborationSocketGateway>(CollaborationSocketGateway);
    // Override logger for testing
    (gateway as any).logger = mockLogger as Logger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test 1: Valid JWT token → connection accepted + user stored in client.data
   */
  describe('Test 1: Valid token → connection accepted', () => {
    it('should accept connection with valid JWT token and store user data', async () => {
      // GIVEN - Mock client with valid JWT token
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwicHJlZmVycmVkX3VzZXJuYW1lIjoiZHJzbWl0aCIsImdpdmVuX25hbWUiOiJKb2huIiwiZmFtaWx5X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obi5zbWl0aEBleGFtcGxlLmNvbSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJzdXJnZW9uIl19fQ.signature';
      
      const mockClient = {
        id: 'socket-123',
        handshake: {
          auth: { token: validToken },
          time: Date.now().toString(),
          address: '192.168.1.100',
          headers: { 'user-agent': 'Mozilla/5.0...' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {}, // Will store user info here
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      await gateway.handleConnection(mockClient);

      // THEN - Connection should be accepted and user data stored
      // For now, this will fail (RED) - we haven't implemented JWT auth yet
      expect(mockClient.data.user).toBeDefined();
      expect(mockClient.data.user.userId).toBe('user123');
      expect(mockClient.data.user.username).toBe('drsmith');
      expect(mockClient.data.user.firstName).toBe('John');
      expect(mockClient.data.user.lastName).toBe('Smith');
      expect(mockClient.data.user.email).toBe('john.smith@example.com');
      expect(mockClient.data.user.roles).toContain('surgeon');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'USER_AUTHENTICATED',
          userId: 'user123',
          username: 'drsmith',
        })
      );
    });
  });

  /**
   * Test 2: Invalid JWT token → connection rejected
   */
  describe('Test 2: Invalid token → connection rejected', () => {
    it('should disconnect client with invalid/malformed JWT token', () => {
      // GIVEN - Mock client with invalid token
      const invalidToken = 'invalid.token.here';
      
      const mockClient = {
        id: 'socket-invalid',
        handshake: {
          auth: { token: invalidToken },
          time: Date.now().toString(),
          address: '192.168.1.200',
          headers: { 'user-agent': 'BadBot/1.0' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      gateway.handleConnection(mockClient);

      // THEN - Client should be disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'AUTH_FAILED',
          reason: 'INVALID_TOKEN',
          socketId: 'socket-invalid',
        })
      );
    });
  });

  /**
   * Test 3: Missing JWT token → connection rejected
   */
  describe('Test 3: Missing token → connection rejected', () => {
    it('should disconnect client without authentication token', () => {
      // GIVEN - Mock client WITHOUT token
      const mockClient = {
        id: 'socket-no-token',
        handshake: {
          auth: {}, // No token
          time: Date.now().toString(),
          address: '192.168.1.300',
          headers: { 'user-agent': 'NoAuthBot/1.0' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      gateway.handleConnection(mockClient);

      // THEN - Client should be disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'AUTH_FAILED',
          reason: 'MISSING_TOKEN',
        })
      );
    });
  });

  /**
   * Test 4: Expired JWT token → connection rejected
   */
  describe('Test 4: Expired token → connection rejected', () => {
    it('should disconnect client with expired JWT token', () => {
      // GIVEN - Mock client with expired token (exp in the past)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyNDU2IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiZXhwaXJlZHVzZXIiLCJleHAiOjE1MDAwMDAwMDB9.signature';
      
      const mockClient = {
        id: 'socket-expired',
        handshake: {
          auth: { token: expiredToken },
          time: Date.now().toString(),
          address: '192.168.1.400',
          headers: { 'user-agent': 'ExpiredBot/1.0' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      gateway.handleConnection(mockClient);

      // THEN - Client should be disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'AUTH_FAILED',
          reason: 'TOKEN_EXPIRED',
        })
      );
    });
  });

  /**
   * Test 5: Extract and store user metadata
   */
  describe('Test 5: Extract and store user metadata', () => {
    it('should extract and store complete user metadata from token and handshake', () => {
      // GIVEN - Mock client with complete user data
      const completeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyNzg5IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiZHJqb25lcyIsImdpdmVuX25hbWUiOiJKYW5lIiwiZmFtaWx5X25hbWUiOiJKb25lcyIsImVtYWlsIjoiamFuZS5qb25lc0BleGFtcGxlLmNvbSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJzdXJnZW9uIiwiYWRtaW4iXX19.signature';
      
      const mockClient = {
        id: 'socket-metadata',
        handshake: {
          auth: { token: completeToken },
          time: Date.now().toString(),
          address: '10.0.0.50',
          headers: { 'user-agent': 'Chrome/120.0.0.0' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      gateway.handleConnection(mockClient);

      // THEN - User metadata should be complete
      expect(mockClient.data.user).toBeDefined();
      expect(mockClient.data.user.userId).toBe('user789');
      expect(mockClient.data.user.username).toBe('drjones');
      expect(mockClient.data.user.firstName).toBe('Jane');
      expect(mockClient.data.user.lastName).toBe('Jones');
      expect(mockClient.data.user.email).toBe('jane.jones@example.com');
      expect(mockClient.data.user.roles).toEqual(['surgeon', 'admin']);

      // Client metadata should be stored
      expect(mockClient.data.metadata).toBeDefined();
      expect(mockClient.data.metadata.ipAddress).toBe('10.0.0.50');
      expect(mockClient.data.metadata.userAgent).toBe('Chrome/120.0.0.0');
      expect(mockClient.data.metadata.connectedAt).toBeGreaterThan(0);
    });
  });

  /**
   * Test 6: Emit authenticated event to client
   */
  describe('Test 6: Emit authenticated event to client', () => {
    it('should emit authenticated event with user data after successful authentication', () => {
      // GIVEN - Mock client with valid token
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyOTk5IiwicHJlZmVycmVkX3VzZXJuYW1lIjoiZHJicm93biIsImdpdmVuX25hbWUiOiJCb2IiLCJmYW1pbHlfbmFtZSI6IkJyb3duIiwiZW1haWwiOiJib2IuYnJvd25AZXhhbXBsZS5jb20iLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsibnVyc2UiXX19.signature';
      
      const mockClient = {
        id: 'socket-emit',
        handshake: {
          auth: { token: validToken },
          time: Date.now().toString(),
          address: '192.168.1.500',
          headers: { 'user-agent': 'Firefox/119.0' },
        },
        conn: {
          transport: { name: 'websocket' },
        },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // WHEN - handleConnection is called
      gateway.handleConnection(mockClient);

      // THEN - authenticated event should be emitted
      expect(mockClient.emit).toHaveBeenCalledWith('authenticated', {
        success: true,
        user: {
          userId: 'user999',
          username: 'drbrown',
          firstName: 'Bob',
          lastName: 'Brown',
          email: 'bob.brown@example.com',
          roles: ['nurse'],
        },
      });
    });
  });
});
