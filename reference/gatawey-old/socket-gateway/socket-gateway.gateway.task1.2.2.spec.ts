import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Server } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

/**
 * Test Suite: Task 1.2.2 - Heartbeat/Ping-Pong Mechanism
 * 
 * Focus: Zombie connection detection via Socket.IO ping/pong
 * 
 * Tests:
 * 1. Socket.IO server configured with custom ping interval/timeout
 * 2. Zombie connections auto-disconnected after ping timeout
 * 
 * TDD Approach: RED → GREEN → REFACTOR
 */
describe('CollaborationSocketGateway - Task 1.2.2: Heartbeat Mechanism', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    // Use centralized mocks (DRY principle)
    mockConfigService = createMockConfigService() as any;
    mockConfigService.getPingInterval = jest.fn().mockReturnValue(25000); // 25 seconds
    mockConfigService.getPingTimeout = jest.fn().mockReturnValue(60000);  // 60 seconds

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

    // Mock Socket.IO server
    mockServer = {
      engine: {
        opts: {},
      },
    } as any;

    // Inject mocked server
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * TEST 1.2.2.1: Ping/Pong Configuration
   * 
   * RED PHASE: Questo test fallirà perché afterInit non configura ancora ping/pong
   * 
   * Verifica che Socket.IO server engine venga configurato con:
   * - pingInterval: tempo tra ping successivi
   * - pingTimeout: timeout per considerare client zombie
   */
  describe('Ping/Pong Configuration', () => {
    it('should configure Socket.IO engine with custom ping interval and timeout', () => {
      // ACT
      gateway.afterInit(mockServer);

      // ASSERT
      expect(mockServer.engine.opts.pingInterval).toBe(25000);
      expect(mockServer.engine.opts.pingTimeout).toBe(60000);
    });

    it('should use default values if config service returns undefined', () => {
      // ARRANGE
      mockConfigService.getPingInterval.mockReturnValue(undefined);
      mockConfigService.getPingTimeout.mockReturnValue(undefined);

      // ACT
      gateway.afterInit(mockServer);

      // ASSERT
      // Socket.IO defaults: pingInterval=25000, pingTimeout=20000
      expect(mockServer.engine.opts.pingInterval).toBe(25000);
      expect(mockServer.engine.opts.pingTimeout).toBe(20000);
    });
  });
});
