import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { createMockConfigService as createMockConfigServiceUtils } from './socket-gateway.test-utils';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { Socket } from 'socket.io';

/**
 * Task 10.1 - Max Connections per User
 * Tests for connection limit enforcement
 */
describe('CollaborationSocketGateway - Task 10.1 - Max Connections per User', () => {
  let gateway: CollaborationSocketGateway;
  let configService: SocketGatewayConfigService;

  // Valid JWT token for testing
  const createToken = (userId: string) => {
    return (
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          sub: userId,
          preferred_username: `user_${userId}`,
          given_name: 'Test',
          family_name: 'User',
          email: `${userId}@example.com`,
          realm_access: { roles: ['user'] },
          exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
        }),
      ).toString('base64') +
      '.signature'
    );
  };

  beforeEach(async () => {
    const mockConfig = createMockConfigService();
    mockConfig.getMaxConnectionsPerUser = jest.fn().mockReturnValue(5); // Test with limit of 5

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

    // Initialize gateway
    gateway.afterInit({} as any);
  });

  const createMockClient = (userId: string, socketId?: string): Partial<Socket> => {
    const token = createToken(userId);
    const id = socketId || `socket-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      handshake: {
        auth: { token },
        address: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
        time: Date.now().toString(),
      } as any,
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
      conn: {
        transport: { name: 'websocket' },
      } as any,
    };
  };

  describe('getUserConnections()', () => {
    it('should return empty array when user has no connections', () => {
      const userId = 'user123';
      
      // Use reflection to call private method
      const connections = (gateway as any).getUserConnections(userId);
      
      expect(connections).toEqual([]);
    });

    it('should return socket IDs for user with single connection', () => {
      const userId = 'user123';
      const client = createMockClient(userId, 'socket-1');

      gateway.handleConnection(client as Socket);

      const connections = (gateway as any).getUserConnections(userId);

      expect(connections).toEqual(['socket-1']);
    });

    it('should return multiple socket IDs for user with multiple connections', () => {
      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);

      const connections = (gateway as any).getUserConnections(userId);

      expect(connections).toHaveLength(2);
      expect(connections).toContain('socket-1');
      expect(connections).toContain('socket-2');
    });

    it('should return only connections for specific user', () => {
      const user1 = 'user123';
      const user2 = 'user456';
      const client1 = createMockClient(user1, 'socket-1');
      const client2 = createMockClient(user2, 'socket-2');
      const client3 = createMockClient(user1, 'socket-3');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);

      const user1Connections = (gateway as any).getUserConnections(user1);
      const user2Connections = (gateway as any).getUserConnections(user2);

      expect(user1Connections).toHaveLength(2);
      expect(user1Connections).toContain('socket-1');
      expect(user1Connections).toContain('socket-3');
      
      expect(user2Connections).toHaveLength(1);
      expect(user2Connections).toContain('socket-2');
    });
  });

  describe('Connection Limit Enforcement', () => {
    it('should accept connections under the limit', () => {
      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');
      const client3 = createMockClient(userId, 'socket-3');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);

      expect(client1.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client2.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client3.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client1.disconnect).not.toHaveBeenCalled();
      expect(client2.disconnect).not.toHaveBeenCalled();
      expect(client3.disconnect).not.toHaveBeenCalled();
    });

    it('should emit warning at 80% threshold (5th connection with limit of 5)', () => {
      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');
      const client3 = createMockClient(userId, 'socket-3');
      const client4 = createMockClient(userId, 'socket-4');
      const client5 = createMockClient(userId, 'socket-5');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);
      gateway.handleConnection(client4 as Socket);
      
      // 5th connection should trigger warning (4/5 = 80%)
      gateway.handleConnection(client5 as Socket);

      // First four connections should not have warnings
      expect(client1.emit).not.toHaveBeenCalledWith(
        'connection:warning',
        expect.any(Object),
      );
      expect(client2.emit).not.toHaveBeenCalledWith(
        'connection:warning',
        expect.any(Object),
      );
      expect(client3.emit).not.toHaveBeenCalledWith(
        'connection:warning',
        expect.any(Object),
      );
      expect(client4.emit).not.toHaveBeenCalledWith(
        'connection:warning',
        expect.any(Object),
      );

      // Fifth connection should have warning (4/5 = 80%)
      expect(client5.emit).toHaveBeenCalledWith(
        'connection:warning',
        expect.objectContaining({
          limit: 5,
          current: 5,
          percentageUsed: 80,
          message: expect.stringContaining('approaching the maximum'),
        }),
      );

      // But connection should still succeed
      expect(client5.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client5.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection when limit is exceeded', () => {
      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');
      const client3 = createMockClient(userId, 'socket-3');
      const client4 = createMockClient(userId, 'socket-4');
      const client5 = createMockClient(userId, 'socket-5');
      const client6 = createMockClient(userId, 'socket-6'); // This should be rejected

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);
      gateway.handleConnection(client4 as Socket);
      gateway.handleConnection(client5 as Socket);
      
      // 6th connection should be rejected (limit is 5)
      gateway.handleConnection(client6 as Socket);

      // First five connections should succeed
      expect(client1.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client2.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client3.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client4.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client5.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );

      // Sixth connection should be rejected
      expect(client6.emit).toHaveBeenCalledWith(
        'connection:rejected',
        expect.objectContaining({
          reason: 'MAX_CONNECTIONS_EXCEEDED',
          limit: 5,
          current: 5,
          message: expect.stringContaining('Maximum number of concurrent connections'),
          retryAfter: expect.any(Number),
        }),
      );
      expect(client6.emit).not.toHaveBeenCalledWith(
        'authenticated',
        expect.any(Object),
      );
      expect(client6.disconnect).toHaveBeenCalledWith(true);
    });

    it('should allow new connection after disconnecting existing one', () => {
      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');
      const client3 = createMockClient(userId, 'socket-3');
      const client4 = createMockClient(userId, 'socket-4');
      const client5 = createMockClient(userId, 'socket-5');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);
      gateway.handleConnection(client4 as Socket);
      gateway.handleConnection(client5 as Socket);

      // Disconnect first client
      gateway.handleDisconnect(client1 as Socket);

      // Now new connection should succeed (6th total, but only 4 active)
      const client6 = createMockClient(userId, 'socket-6');
      gateway.handleConnection(client6 as Socket);

      expect(client6.emit).toHaveBeenCalledWith(
        'authenticated',
        expect.objectContaining({ success: true }),
      );
      expect(client6.disconnect).not.toHaveBeenCalled();
    });

    it('should enforce limits per user, not globally', () => {
      const user1 = 'user123';
      const user2 = 'user456';

      // Connect 5 clients for user1 (at limit)
      const user1Client1 = createMockClient(user1, 'socket-1');
      const user1Client2 = createMockClient(user1, 'socket-2');
      const user1Client3 = createMockClient(user1, 'socket-3');
      const user1Client4 = createMockClient(user1, 'socket-4');
      const user1Client5 = createMockClient(user1, 'socket-5');

      gateway.handleConnection(user1Client1 as Socket);
      gateway.handleConnection(user1Client2 as Socket);
      gateway.handleConnection(user1Client3 as Socket);
      gateway.handleConnection(user1Client4 as Socket);
      gateway.handleConnection(user1Client5 as Socket);

      // Connect 5 clients for user2 (should also succeed, separate limit)
      const user2Client1 = createMockClient(user2, 'socket-6');
      const user2Client2 = createMockClient(user2, 'socket-7');
      const user2Client3 = createMockClient(user2, 'socket-8');
      const user2Client4 = createMockClient(user2, 'socket-9');
      const user2Client5 = createMockClient(user2, 'socket-10');

      gateway.handleConnection(user2Client1 as Socket);
      gateway.handleConnection(user2Client2 as Socket);
      gateway.handleConnection(user2Client3 as Socket);
      gateway.handleConnection(user2Client4 as Socket);
      gateway.handleConnection(user2Client5 as Socket);

      // All connections should succeed
      expect(user1Client1.disconnect).not.toHaveBeenCalled();
      expect(user1Client2.disconnect).not.toHaveBeenCalled();
      expect(user1Client3.disconnect).not.toHaveBeenCalled();
      expect(user1Client4.disconnect).not.toHaveBeenCalled();
      expect(user1Client5.disconnect).not.toHaveBeenCalled();
      expect(user2Client1.disconnect).not.toHaveBeenCalled();
      expect(user2Client2.disconnect).not.toHaveBeenCalled();
      expect(user2Client3.disconnect).not.toHaveBeenCalled();
      expect(user2Client4.disconnect).not.toHaveBeenCalled();
      expect(user2Client5.disconnect).not.toHaveBeenCalled();

      // But 6th connection for either user should be rejected
      const user1Client6 = createMockClient(user1, 'socket-11');
      const user2Client6 = createMockClient(user2, 'socket-12');

      gateway.handleConnection(user1Client6 as Socket);
      gateway.handleConnection(user2Client6 as Socket);

      expect(user1Client6.emit).toHaveBeenCalledWith(
        'connection:rejected',
        expect.objectContaining({ reason: 'MAX_CONNECTIONS_EXCEEDED' }),
      );
      expect(user2Client6.emit).toHaveBeenCalledWith(
        'connection:rejected',
        expect.objectContaining({ reason: 'MAX_CONNECTIONS_EXCEEDED' }),
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configured max connections limit', () => {
      expect(configService.getMaxConnectionsPerUser()).toBe(5);

      const userId = 'user123';
      const client1 = createMockClient(userId, 'socket-1');
      const client2 = createMockClient(userId, 'socket-2');
      const client3 = createMockClient(userId, 'socket-3');
      const client4 = createMockClient(userId, 'socket-4');
      const client5 = createMockClient(userId, 'socket-5');
      const client6 = createMockClient(userId, 'socket-6');

      gateway.handleConnection(client1 as Socket);
      gateway.handleConnection(client2 as Socket);
      gateway.handleConnection(client3 as Socket);
      gateway.handleConnection(client4 as Socket);
      gateway.handleConnection(client5 as Socket);
      gateway.handleConnection(client6 as Socket);

      expect(configService.getMaxConnectionsPerUser).toHaveBeenCalled();
      expect(client6.disconnect).toHaveBeenCalledWith(true);
    });
  });
});
