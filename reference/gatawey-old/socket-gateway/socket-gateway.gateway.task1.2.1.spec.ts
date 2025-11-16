import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

/**
 * Test Suite: Task 1.2.1 - Enhanced Disconnection Logging
 * 
 * Focus: INFRASTRUCTURE ONLY (no business logic)
 * 
 * Tests:
 * 1. Structured logging with session duration, transport, metadata
 * 2. Cleanup of Socket.IO listeners (memory leak prevention)
 * 
 * TDD Approach: RED → GREEN → REFACTOR
 */
describe('CollaborationSocketGateway - Task 1.2.1: handleDisconnect Logging', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(async () => {
    // Use centralized mocks (DRY principle)
    mockConfigService = createMockConfigService() as any;

    // Create test module
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
    
    // Mock logger to capture calls
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;
    
    (gateway as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * TEST 1.2.1.1: Structured Logging on Disconnect
   * 
   * Verifica che venga fatto log strutturato con:
   * - Session duration
   * - Transport type (websocket/polling)
   * - IP address
   * - User agent
   * - Timestamp
   */
  describe('Structured Logging', () => {
    it('should log detailed disconnection information', () => {
      // ARRANGE
      const connectedAt = Date.now() - 120000; // Connected 2 minutes ago
      const mockClient = {
        id: 'socket-abc-123',
        data: {
          metadata: {
            connectedAt, // BaseSocketGateway reads from here
          },
        },
        handshake: {
          time: connectedAt.toString(),
          address: '192.168.1.100',
          headers: {
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0',
          },
        },
        conn: {
          transport: {
            name: 'websocket',
          },
        },
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // ACT
      gateway.handleDisconnect(mockClient);

      // ASSERT
      // Task 1.2.3: Now uses warn() for unknown disconnect reasons
      // BaseSocketGateway logs structured data with disconnect categorization
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'CLIENT_DISCONNECTED',
          socketId: 'socket-abc-123',
          sessionDuration: expect.any(Number),
          sessionDurationMinutes: 2,
          transport: 'websocket',
          ip: '192.168.1.100',
          userAgent: expect.stringContaining('Chrome'),
          timestamp: expect.any(String),
          disconnectCategory: 'UNKNOWN',
          disconnectReason: 'unknown',
        })
      );
    });

    it('should handle missing transport gracefully', () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-xyz-456',
        data: {}, // Task 1.2.3: Add data property for compatibility
        handshake: {
          time: Date.now().toString(),
          address: '10.0.0.1',
          headers: {},
        },
        conn: {}, // No transport property
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // ACT
      gateway.handleDisconnect(mockClient);

      // ASSERT
      // Task 1.2.3: Now uses warn() for unknown disconnect reasons
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: 'unknown',
        })
      );
    });
  });

  /**
   * TEST 1.2.1.2: Memory Leak Prevention
   * 
   * Verifica che removeAllListeners() venga chiamato
   * per evitare memory leak di Socket.IO listeners
   */
  describe('Listener Cleanup', () => {
    it('should call removeAllListeners() to prevent memory leaks', () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-mem-test',
        data: {}, // Task 1.2.3: Add data property for compatibility
        handshake: {
          time: Date.now().toString(),
          address: '127.0.0.1',
          headers: {},
        },
        conn: {},
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // ACT
      gateway.handleDisconnect(mockClient);

      // ASSERT
      expect(mockClient.removeAllListeners).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * TEST 1.2.1.3: Legacy Logging Compatibility
   * 
   * Verifica che config service logging venga ancora chiamato
   * per backward compatibility
   */
  describe('Legacy Logging', () => {
    it('should call config service logClientDisconnected', () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-legacy',
        data: {}, // Task 1.2.3: Add data property for compatibility
        handshake: {
          time: Date.now().toString(),
          address: '::1',
          headers: {},
        },
        conn: {},
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // ACT
      gateway.handleDisconnect(mockClient);

      // ASSERT
      // BaseSocketGateway now passes: socketId, reason
      expect(mockConfigService.logClientDisconnected).toHaveBeenCalledWith('socket-legacy', 'unknown');
    });
  });

  /**
   * TEST 1.2.1.4: Gateway Disabled Guard
   * 
   * Verifica che se gateway è disabilitato, non viene fatto nulla
   */
  describe('Gateway Disabled', () => {
    it('should skip all processing if gateway is disabled', () => {
      // ARRANGE
      mockConfigService.isEnabled.mockReturnValue(false);
      
      const mockClient = {
        id: 'socket-disabled',
        removeAllListeners: jest.fn(),
      } as unknown as Socket;

      // ACT
      gateway.handleDisconnect(mockClient);

      // ASSERT
      // Task 1.2.3: Check that no log methods are called (log/warn/error)
      expect(mockLogger.log).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockClient.removeAllListeners).not.toHaveBeenCalled();
      expect(mockConfigService.logClientDisconnected).not.toHaveBeenCalled();
    });
  });
});
