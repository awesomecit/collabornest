/**
 * TASK 10.4 - Rate Limiting Integration Tests
 * 
 * Unit-style tests for rate limiting functionality in CollaborationSocketGateway.
 * Tests call gateway methods directly with mocked TypedSocket clients.
 * 
 * Test Coverage:
 * - Rate limit exceeded for room:join (2 per 5 seconds)
 * - Progressive penalties (violations → warnings → disconnect → ban)
 * - Ban mechanism and expiry
 * - Violations tracking and expiry
 * - Cleanup on disconnect
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { TypedSocket } from './socket-gateway.types';

describe('TASK 10.4 - Rate Limiting Integration Tests', () => {
  let gateway: CollaborationSocketGateway;

  beforeEach(async () => {
    const mockConfig = createMockConfigService();
    (mockConfig.getMaxConnectionsPerUser as jest.Mock).mockReturnValue(5);
    (mockConfig.getRoomLimits as jest.Mock).mockReturnValue({
      surgery: 20,
      admin_panel: 5,
      chat: 100,
      default: 50,
    });
    (mockConfig.getPort as jest.Mock).mockReturnValue(3001);
    (mockConfig.getNamespace as jest.Mock).mockReturnValue('/api/n/ws');
    (mockConfig.getCorsConfig as jest.Mock).mockReturnValue({ origin: '*' });
    (mockConfig.getTransports as jest.Mock).mockReturnValue(['websocket']);
    (mockConfig.getPingTimeout as jest.Mock).mockReturnValue(60000);
    (mockConfig.getPingInterval as jest.Mock).mockReturnValue(25000);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationSocketGateway,
        { provide: SocketGatewayConfigService, useValue: mockConfig },
        { provide: SurgeryManagementService, useValue: createMockSurgeryService() },
      ],
    }).compile();

    gateway = moduleFixture.get<CollaborationSocketGateway>(CollaborationSocketGateway);

    // Mock server
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn(() => ({ emit: jest.fn() })),
    } as any;

    gateway.afterInit(gateway.server);
  });

  afterEach(() => {
    gateway.resetRateLimitState();
    jest.clearAllMocks();
  });

  /** Helper: Create mock TypedSocket */
  function createMockClient(socketId: string, userId = 'user-123'): TypedSocket {
    return {
      id: socketId,
      emit: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      to: jest.fn(() => ({ emit: jest.fn() })),
      disconnect: jest.fn(),
      data: {
        user: {
          userId,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
      },
      handshake: { address: '127.0.0.1' },
      conn: { transport: { name: 'websocket' } },
    } as unknown as TypedSocket;
  }

  /** Helper: Sleep */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ============================================================================
  // Test Group 1: Rate Limit Exceeded
  // ============================================================================

  describe('Group 1: Rate Limit Exceeded', () => {
    it('TEST 10.4.1 - should allow 2 room:join within 5s', async () => {
      const client = createMockClient('socket-1');

      await gateway.handleJoinRoom({ roomId: 'surgery-123' }, client);
      await gateway.handleJoinRoom({ roomId: 'surgery-456' }, client);

      expect(client.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({ roomId: 'surgery-123' }));
      expect(client.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({ roomId: 'surgery-456' }));
      expect(gateway.getRateLimitState().violations.size).toBe(0);
    });

    it('TEST 10.4.2 - should reject 3rd room:join (exceeds limit 2/5s)', async () => {
      const client = createMockClient('socket-1');

      await gateway.handleJoinRoom({ roomId: 'surgery-1' }, client);
      await gateway.handleJoinRoom({ roomId: 'surgery-2' }, client);

      (client.emit as jest.Mock).mockClear();
      await gateway.handleJoinRoom({ roomId: 'surgery-3' }, client);

      expect(client.emit).toHaveBeenCalledWith('rate_limit_exceeded', expect.objectContaining({
        event: 'room:join',
        limit: 2,
        window: 5000,
        violations: 1,
      }));
      expect(client.emit).not.toHaveBeenCalledWith('room:joined', expect.anything());
      expect(gateway.getRateLimitState().violations.get(client.id)?.count).toBe(1);
    });

    it('TEST 10.4.3 - should allow after sliding window expires', async () => {
      const client = createMockClient('socket-1');

      await gateway.handleJoinRoom({ roomId: 'surgery-1' }, client);
      await gateway.handleJoinRoom({ roomId: 'surgery-2' }, client);

      await sleep(5200); // Wait for window expiry

      (client.emit as jest.Mock).mockClear();
      await gateway.handleJoinRoom({ roomId: 'surgery-3' }, client);

      expect(client.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({ roomId: 'surgery-3' }));
      expect(gateway.getRateLimitState().violations.size).toBe(0);
    }, 10000);
  });

  // ============================================================================
  // Test Group 2: Progressive Penalties
  // ============================================================================

  describe('Group 2: Progressive Penalties', () => {
    it('TEST 10.4.4 - should warn on 1-2 violations (no disconnect)', async () => {
      const client = createMockClient('socket-1');

      // Use up rate limit (2 allowed)
      await gateway.handleJoinRoom({ roomId: 'a' }, client);
      await gateway.handleJoinRoom({ roomId: 'b' }, client);

      // Trigger 1st violation
      await gateway.handleJoinRoom({ roomId: 'c' }, client);

      await sleep(5100); // Wait for window reset

      // Use up rate limit again
      await gateway.handleJoinRoom({ roomId: 'd' }, client);
      await gateway.handleJoinRoom({ roomId: 'e' }, client);

      // Trigger 2nd violation
      await gateway.handleJoinRoom({ roomId: 'f' }, client);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(gateway.getRateLimitState().violations.get(client.id)?.count).toBe(2);
    }, 10000);

    it('TEST 10.4.5 - should disconnect on 3rd violation', async () => {
      const client = createMockClient('socket-1');

      // Trigger 3 violations (one per window)
      for (let i = 1; i <= 3; i++) {
        // Use up rate limit
        await gateway.handleJoinRoom({ roomId: `${i}a` }, client);
        await gateway.handleJoinRoom({ roomId: `${i}b` }, client);

        // Trigger violation
        await gateway.handleJoinRoom({ roomId: `${i}c` }, client);

        if (i < 3) {
          await sleep(5100); // Reset window between violations
        }
      }

      await sleep(150); // Wait for disconnect timeout
      expect(client.disconnect).toHaveBeenCalled();
      expect(gateway.getRateLimitState().violations.get(client.id)?.count).toBe(3);
    }, 20000);

    it('TEST 10.4.6 - should ban on 5th violation (5 minutes)', async () => {
      const client = createMockClient('socket-1');

      // Trigger 5 violations
      for (let i = 0; i < 5; i++) {
        await gateway.handleJoinRoom({ roomId: '1' }, client);
        await gateway.handleJoinRoom({ roomId: '2' }, client);
        await gateway.handleJoinRoom({ roomId: '3' }, client);
        await sleep(50);
      }

      expect(client.emit).toHaveBeenCalledWith('connection:banned', expect.objectContaining({
        reason: 'RATE_LIMIT_ABUSE',
        duration: 5 * 60 * 1000,
        violations: 5,
      }));

      await sleep(150);
      expect(client.disconnect).toHaveBeenCalled();
      expect(gateway.getRateLimitState().bannedUsers.has(client.id)).toBe(true);
    });
  });

  // ============================================================================
  // Test Group 3: Ban Mechanism
  // ============================================================================

  describe('Group 3: Ban Mechanism', () => {
    it('TEST 10.4.7 - should reject all events from banned user', async () => {
      const client = createMockClient('socket-1');
      const state = gateway.getRateLimitState();
      state.bannedUsers.set(client.id, { bannedUntil: Date.now() + 60000, reason: 'RATE_LIMIT_ABUSE' });

      await gateway.handleJoinRoom({ roomId: 'test' }, client);

      expect(client.emit).toHaveBeenCalledWith('rate_limit_exceeded', expect.anything());
      expect(client.emit).not.toHaveBeenCalledWith('room:joined', expect.anything());
    });

    it('TEST 10.4.8 - should allow after ban expires', async () => {
      const client = createMockClient('socket-1');
      const state = gateway.getRateLimitState();
      state.bannedUsers.set(client.id, { bannedUntil: Date.now() + 100, reason: 'RATE_LIMIT_ABUSE' });

      await sleep(150); // Wait for ban expiry

      (client.emit as jest.Mock).mockClear();
      await gateway.handleJoinRoom({ roomId: 'test' }, client);

      expect(client.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({ roomId: 'test' }));
      expect(gateway.getRateLimitState().bannedUsers.has(client.id)).toBe(false);
    });
  });

  // ============================================================================
  // Test Group 4: Violations Tracking
  // ============================================================================

  describe('Group 4: Violations Tracking', () => {
    it('TEST 10.4.9 - should reset violation count after 5min of no violations', async () => {
      const client = createMockClient('socket-1');
      const state = gateway.getRateLimitState();

      // Set old violation (6 minutes ago)
      state.violations.set(client.id, { count: 2, lastViolation: Date.now() - 6 * 60 * 1000 });

      // Trigger new violation
      await gateway.handleJoinRoom({ roomId: '1' }, client);
      await gateway.handleJoinRoom({ roomId: '2' }, client);
      await gateway.handleJoinRoom({ roomId: '3' }, client);

      const violation = gateway.getRateLimitState().violations.get(client.id);
      expect(violation?.count).toBe(1); // Reset to 1 (old violations expired)
    });

    it('TEST 10.4.10 - should accumulate violations within 5min window', async () => {
      const client = createMockClient('socket-1');
      const state = gateway.getRateLimitState();

      // Set recent violation (1 minute ago)
      state.violations.set(client.id, { count: 2, lastViolation: Date.now() - 1 * 60 * 1000 });

      // Trigger new violation
      await gateway.handleJoinRoom({ roomId: '1' }, client);
      await gateway.handleJoinRoom({ roomId: '2' }, client);
      await gateway.handleJoinRoom({ roomId: '3' }, client);

      const violation = gateway.getRateLimitState().violations.get(client.id);
      expect(violation?.count).toBe(3); // Accumulated (2 + 1)
    });
  });

  // ============================================================================
  // Test Group 5: Cleanup
  // ============================================================================

  describe('Group 5: Cleanup on Disconnect', () => {
    it('TEST 10.4.11 - should cleanup rate limiters on disconnect', async () => {
      const client = createMockClient('socket-1');

      await gateway.handleJoinRoom({ roomId: 'test' }, client);
      expect(gateway.getRateLimitState().rateLimiters.has(client.id)).toBe(true);

      gateway['onClientDisconnecting'](client);
      expect(gateway.getRateLimitState().rateLimiters.has(client.id)).toBe(false);
    });

    it('TEST 10.4.12 - should keep violations after disconnect', async () => {
      const client = createMockClient('socket-1');

      // Trigger violation
      await gateway.handleJoinRoom({ roomId: '1' }, client);
      await gateway.handleJoinRoom({ roomId: '2' }, client);
      await gateway.handleJoinRoom({ roomId: '3' }, client);

      const socketId = client.id;
      expect(gateway.getRateLimitState().violations.has(socketId)).toBe(true);

      gateway['onClientDisconnecting'](client);
      expect(gateway.getRateLimitState().violations.has(socketId)).toBe(true); // Still exists
    });
  });
});
