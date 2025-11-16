import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * TASK 1.1 - Gateway Initialization Tests
 * 
 * Test Strategy: Unit Testing con Mock Completo - TDD Approach (RED → GREEN → REFACTOR)
 * - NO connessioni reali
 * - Mock di tutti i servizi
 * - Focus su inizializzazione e lifecycle
 * - Un test alla volta con ciclo RED-GREEN-REFACTOR completo
 * 
 * Coverage Target: 100% del codice del gateway
 * 
 * Authentication: SKIPPED in Task 1.1 (internal network, no data persistence)
 */
describe('CollaborationSocketGateway - TASK 1.1: Initialization & Lifecycle', () => {
  let gateway: CollaborationSocketGateway;
  let configService: SocketGatewayConfigService;
  let mockConfigService: Partial<SocketGatewayConfigService>;
  let mockServer: Partial<Server>;
  let mockClient: Partial<Socket>;

  beforeEach(async () => {
    // ============================================
    // MOCK SETUP - Configuration Service
    // ============================================
    mockConfigService = createMockConfigService();
    (mockConfigService.getPort as jest.Mock).mockReturnValue(3001);
    (mockConfigService.getNamespace as jest.Mock).mockReturnValue('/surgery-collaboration');
    (mockConfigService.getCorsConfig as jest.Mock).mockReturnValue({
      origin: ['http://localhost:3000', 'http://localhost:4200'],
      credentials: true,
    });
    (mockConfigService.getTransports as jest.Mock).mockReturnValue(['websocket', 'polling']);
    (mockConfigService.getPingInterval as jest.Mock).mockReturnValue(25000); // Task 1.2.2
    (mockConfigService.getPingTimeout as jest.Mock).mockReturnValue(20000);  // Task 1.2.2
    (mockConfigService.getMaxConnectionsPerUser as jest.Mock).mockReturnValue(999); // Task 10.1: High limit for tests

    // ============================================
    // MOCK SETUP - Socket.IO Server
    // ============================================
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      engine: {
        opts: {
          cors: {},
        },
      } as any,
    };

    // ============================================
    // MOCK SETUP - Socket.IO Client
    // ============================================
    // Task 1.2.4: Add valid JWT token for authentication
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwicHJlZmVycmVkX3VzZXJuYW1lIjoidGVzdHVzZXIiLCJnaXZlbl9uYW1lIjoiVGVzdCIsImZhbWlseV9uYW1lIjoiVXNlciIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInJlYWxtX2FjY2VzcyI6eyJyb2xlcyI6WyJ1c2VyIl19fQ.signature';

    mockClient = {
      id: 'test-client-123',
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      removeAllListeners: jest.fn(), // Task 1.2.1: Memory leak prevention
      handshake: {
        time: Date.now().toString(), // Task 1.2.1: Session duration calculation
        address: '192.168.1.100',
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
        auth: { token: validToken }, // Task 1.2.4: JWT token
        query: {},
      } as any,
      conn: {
        transport: { name: 'websocket' }, // Task 1.2.1: Transport type logging
      } as any,
      data: {},
    };

    // ============================================
    // CREATE TEST MODULE
    // ============================================
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

    gateway = module.get<CollaborationSocketGateway>(
      CollaborationSocketGateway,
    );
    configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );

    // Inject mock server into gateway
    gateway.server = mockServer as Server;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // TEST GROUP 1: GATEWAY INITIALIZATION
  // ============================================
  describe('Group 1: Gateway Initialization', () => {
    // TEST 1.1.1
    it('TEST 1.1.1 - should initialize gateway with correct configuration', () => {
      // GIVEN - gateway is created in beforeEach
      
      // WHEN - we verify the gateway is properly initialized
      
      // THEN
      expect(gateway).toBeDefined();
      expect(gateway).toBeInstanceOf(CollaborationSocketGateway);
    });

    // TEST 1.1.2
    it('TEST 1.1.2 - should inject SocketGatewayConfigService dependency', () => {
      // GIVEN - gateway created in beforeEach
      
      // WHEN - we access the private configService
      const injectedConfigService = gateway['configService'];
      
      // THEN
      expect(injectedConfigService).toBe(configService);
      expect(injectedConfigService).toBeDefined();
    });

    // TEST 1.1.3 - RED PHASE
    it('TEST 1.1.3 - should have Logger instance', () => {
      // GIVEN - gateway created
      
      // WHEN - we access the logger
      const logger = gateway['logger'];
      
      // THEN
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });

    // TEST 1.1.4 - RED PHASE
    it('TEST 1.1.4 - should have @WebSocketServer decorator injecting server', () => {
      // GIVEN - gateway created
      
      // WHEN - we check the server property
      
      // THEN
      expect(gateway.server).toBeDefined();
      expect(gateway.server).toBe(mockServer);
    });

  });

  // ============================================
  // TEST GROUP 2: LIFECYCLE - afterInit Hook
  // ============================================
  describe('Group 2: Lifecycle - afterInit Hook', () => {
    // TEST 1.1.6
    it('TEST 1.1.6 - should call afterInit and log server initialization', () => {
      // GIVEN
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      // WHEN
      gateway.afterInit(mockServer as Server);
      
      // THEN
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('='.repeat(60)));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket Gateway initialized successfully'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Port: 3001'));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Namespace: /surgery-collaboration'),
      );
    });

    // TEST 1.1.7 - UPDATED for Socket.IO v4 compatibility
    it('TEST 1.1.7 - should log CORS configuration in afterInit', () => {
      // GIVEN
      const corsConfig = {
        origin: ['http://localhost:3000'],
        credentials: true,
      };
      mockConfigService.getCorsConfig = jest.fn().mockReturnValue(corsConfig);
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      // WHEN
      gateway.afterInit(mockServer as Server);
      
      // THEN
      // NOTE: CORS is now configured in @WebSocketGateway decorator, not in engine.opts
      // (Socket.IO v4 removed server.engine.opts.cors API)
      expect(configService.getCorsConfig).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('CORS Origins'),
      );
    });

    // TEST 1.1.8 - RED PHASE
    it('TEST 1.1.8 - should NOT initialize if gateway is disabled', () => {
      // GIVEN
      mockConfigService.isEnabled = jest.fn().mockReturnValue(false);
      const loggerWarnSpy = jest.spyOn(gateway['logger'], 'warn');
      const loggerLogSpy = jest.spyOn(gateway['logger'], 'log');
      
      // WHEN
      gateway.afterInit(mockServer as Server);
      
      // THEN
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DISABLED'),
      );
      expect(loggerLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully'),
      );
    });
  });

  // ============================================
  // TEST GROUP 3: LIFECYCLE - handleConnection Hook
  // ============================================
  describe('Group 3: Lifecycle - handleConnection Hook', () => {
    // TEST 1.1.9 - RED PHASE
    it('TEST 1.1.9 - should handle client connection and log event', () => {
      // GIVEN
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      
      // WHEN
      gateway.handleConnection(mockClient as Socket);
      
      // THEN
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client attempting to connect: test-client-123'),
      );
    });

    // TEST 1.1.10 - Updated for BaseSocketGateway refactoring
    it('TEST 1.1.10 - should call configService.logClientConnected with metadata', () => {
      // GIVEN
      const logClientConnectedSpy = mockConfigService.logClientConnected as jest.Mock;
      
      // WHEN
      gateway.handleConnection(mockClient as Socket);
      
      // THEN
      // BaseSocketGateway now passes: socketId, { transport, userId, username }
      expect(logClientConnectedSpy).toHaveBeenCalledWith('test-client-123', {
        transport: 'websocket',
        userId: 'test-user-123',
        username: 'testuser',
      });
    });

    // TEST 1.1.11 - RED PHASE
    it('TEST 1.1.11 - should disconnect client immediately if gateway disabled', () => {
      // GIVEN
      mockConfigService.isEnabled = jest.fn().mockReturnValue(false);
      const disconnectSpy = mockClient.disconnect as jest.Mock;
      
      // WHEN
      gateway.handleConnection(mockClient as Socket);
      
      // THEN
      expect(disconnectSpy).toHaveBeenCalledWith(true);
    });
  });

  // ============================================
  // TEST GROUP 4: LIFECYCLE - handleDisconnect Hook
  // ============================================
  describe('Group 4: Lifecycle - handleDisconnect Hook', () => {
    // TEST 1.1.12 - RED PHASE
    it('TEST 1.1.12 - should handle client disconnection and log event', () => {
      // GIVEN
      // Task 1.2.3: Now uses warn() for unknown disconnect reasons
      const loggerSpy = jest.spyOn(gateway['logger'], 'warn');
      
      // WHEN
      gateway.handleDisconnect(mockClient as Socket);
      
      // THEN
      // Task 1.2.1: Now logs structured data object instead of string
      // Task 1.2.3: Uses warn level for unknown disconnect category
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'CLIENT_DISCONNECTED',
          socketId: 'test-client-123',
        }),
      );
    });

    // TEST 1.1.13 - Updated for BaseSocketGateway refactoring
    it('TEST 1.1.13 - should call configService.logClientDisconnected', () => {
      // GIVEN
      const logClientDisconnectedSpy = mockConfigService.logClientDisconnected as jest.Mock;
      
      // WHEN
      gateway.handleDisconnect(mockClient as Socket);
      
      // THEN
      // BaseSocketGateway now passes: socketId, reason (defaults to 'unknown')
      expect(logClientDisconnectedSpy).toHaveBeenCalledWith('test-client-123', 'unknown');
    });

    // TEST 1.1.14 - RED PHASE
    it('TEST 1.1.14 - should NOT process disconnect if gateway disabled', () => {
      // GIVEN
      mockConfigService.isEnabled = jest.fn().mockReturnValue(false);
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const logClientDisconnectedSpy = mockConfigService.logClientDisconnected as jest.Mock;
      
      // WHEN
      gateway.handleDisconnect(mockClient as Socket);
      
      // THEN
      expect(loggerSpy).not.toHaveBeenCalled();
      expect(logClientDisconnectedSpy).not.toHaveBeenCalled();
    });
  });
});
