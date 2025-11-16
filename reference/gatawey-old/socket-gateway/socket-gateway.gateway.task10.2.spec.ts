import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { createMockConfigService as createMockConfigServiceUtils } from './socket-gateway.test-utils';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { Socket } from 'socket.io';
import { JoinRoomDto } from './socket-gateway.dto';

/**
 * Task 10.2 - Max Users per Room
 * Tests for room capacity limit enforcement
 */
describe('CollaborationSocketGateway - Task 10.2 - Max Users per Room', () => {
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
    mockConfig.getRoomLimits = jest.fn().mockReturnValue({
      surgery: 3, // Test with small limit for easier testing
      admin_panel: 2,
      chat: 5,
      default: 4,
    });

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

    // Initialize gateway and mock server.to() for broadcasting
    const mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.afterInit(mockServer as any);
    (gateway as any).server = mockServer;
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
      join: jest.fn(),
      to: jest.fn().mockReturnThis(),
      conn: {
        transport: { name: 'websocket' },
      } as any,
    };
  };

  describe('handleJoinRoom() - Room Capacity Limits', () => {
    it('should allow join when room is empty', async () => {
      const client = createMockClient('user1', 'socket-1');
      gateway.handleConnection(client as Socket);

      const joinDto: JoinRoomDto = { roomId: 'surgery:room-1' };
      await gateway.handleJoinRoom(joinDto, client as any);

      expect(client.join).toHaveBeenCalledWith('surgery:room-1');
      expect(client.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({
        roomId: 'surgery:room-1',
        success: true,
      }));
    });

    it('should allow join when room has space (below limit)', async () => {
      // First user joins
      const client1 = createMockClient('user1', 'socket-1');
      gateway.handleConnection(client1 as Socket);
      const joinDto1: JoinRoomDto = { roomId: 'surgery:room-1' };
      await gateway.handleJoinRoom(joinDto1, client1 as any);

      // Second user joins (surgery limit is 3)
      const client2 = createMockClient('user2', 'socket-2');
      gateway.handleConnection(client2 as Socket);
      const joinDto2: JoinRoomDto = { roomId: 'surgery:room-1' };
      await gateway.handleJoinRoom(joinDto2, client2 as any);

      expect(client2.join).toHaveBeenCalledWith('surgery:room-1');
      expect(client2.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({
        roomId: 'surgery:room-1',
        success: true,
      }));
    });

    it('should reject join when room is full', async () => {
      // Fill room to capacity (surgery limit is 3)
      for (let i = 1; i <= 3; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'surgery:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Fourth user tries to join
      const client4 = createMockClient('user4', 'socket-4');
      gateway.handleConnection(client4 as Socket);
      const joinDto4: JoinRoomDto = { roomId: 'surgery:room-1' };
      await gateway.handleJoinRoom(joinDto4, client4 as any);

      // Should not join room
      expect(client4.join).not.toHaveBeenCalled();

      // Should receive rejection event
      expect(client4.emit).toHaveBeenCalledWith('room:join_rejected', expect.objectContaining({
        roomId: 'surgery:room-1',
        reason: 'ROOM_FULL',
        currentUsers: 3,
        maxUsers: 3,
      }));
    });

    it('should apply correct limit for surgery resource type', async () => {
      // Surgery limit is 3
      for (let i = 1; i <= 3; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'surgery:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
        expect(client.join).toHaveBeenCalled();
      }

      // Fourth user should be rejected
      const client4 = createMockClient('user4', 'socket-4');
      gateway.handleConnection(client4 as Socket);
      const joinDto4: JoinRoomDto = { roomId: 'surgery:room-1' };
      await gateway.handleJoinRoom(joinDto4, client4 as any);
      expect(client4.join).not.toHaveBeenCalled();
    });

    it('should apply correct limit for admin_panel resource type', async () => {
      // Admin panel limit is 2
      for (let i = 1; i <= 2; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'admin_panel:panel-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
        expect(client.join).toHaveBeenCalled();
      }

      // Third user should be rejected
      const client3 = createMockClient('user3', 'socket-3');
      gateway.handleConnection(client3 as Socket);
      const joinDto3: JoinRoomDto = { roomId: 'admin_panel:panel-1' };
      await gateway.handleJoinRoom(joinDto3, client3 as any);
      expect(client3.join).not.toHaveBeenCalled();
    });

    it('should apply default limit for unknown resource type', async () => {
      // Default limit is 4
      for (let i = 1; i <= 4; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'unknown_resource:resource-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
        expect(client.join).toHaveBeenCalled();
      }

      // Fifth user should be rejected
      const client5 = createMockClient('user5', 'socket-5');
      gateway.handleConnection(client5 as Socket);
      const joinDto5: JoinRoomDto = { roomId: 'unknown_resource:resource-1' };
      await gateway.handleJoinRoom(joinDto5, client5 as any);
      expect(client5.join).not.toHaveBeenCalled();
    });

    it('should emit capacity warning at 90% threshold', async () => {
      const mockServer = (gateway as any).server;
      
      // Surgery limit is 3, so 90% is reached at 3 users (100%)
      // Let's test with chat (limit 5), 90% is reached at 5 users (5/5 = 100%)
      // Actually 90% would be 4.5, so 5 users triggers warning
      
      // Add 4 users (80% capacity) - no warning
      for (let i = 1; i <= 4; i++) {
        jest.clearAllMocks();
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'chat:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Add 5th user (100% capacity) - should trigger warning
      jest.clearAllMocks();
      const client5 = createMockClient('user5', 'socket-5');
      gateway.handleConnection(client5 as Socket);
      const joinDto5: JoinRoomDto = { roomId: 'chat:room-1' };
      await gateway.handleJoinRoom(joinDto5, client5 as any);

      // Should emit capacity warning to all users in room
      expect(mockServer.to).toHaveBeenCalledWith('chat:room-1');
      expect(mockServer.emit).toHaveBeenCalledWith('room:capacity_warning', expect.objectContaining({
        roomId: 'chat:room-1',
        currentUsers: 5,
        maxUsers: 5,
        percentageUsed: 100,
      }));
    });

    it('should not emit capacity warning below 90% threshold', async () => {
      const mockServer = (gateway as any).server;
      jest.clearAllMocks();

      // Add 2 users to chat room (40% capacity) - no warning
      for (let i = 1; i <= 2; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'chat:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Should not emit capacity warning
      const capacityWarningCalls = (mockServer.emit as jest.Mock).mock.calls.filter(
        call => call[0] === 'room:capacity_warning'
      );
      expect(capacityWarningCalls.length).toBe(0);
    });

    it('should track multiple rooms independently', async () => {
      // Room 1: Fill to capacity (surgery limit 3)
      for (let i = 1; i <= 3; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'surgery:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Room 2: Should still accept users
      const client4 = createMockClient('user4', 'socket-4');
      gateway.handleConnection(client4 as Socket);
      const joinDto4: JoinRoomDto = { roomId: 'surgery:room-2' };
      await gateway.handleJoinRoom(joinDto4, client4 as any);

      expect(client4.join).toHaveBeenCalledWith('surgery:room-2');
      expect(client4.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({
        roomId: 'surgery:room-2',
        success: true,
      }));
    });
  });

  describe('handleQueryRoomUsers() - Capacity Information', () => {
    it('should include capacity information in room:users response', async () => {
      // Add 2 users to surgery room (limit 3)
      for (let i = 1; i <= 2; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'surgery:room-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Query room users
      const queryClient = createMockClient('user3', 'socket-3');
      gateway.handleConnection(queryClient as Socket);
      await gateway.handleQueryRoomUsers(
        { roomId: 'surgery:room-1' },
        queryClient as any,
      );

      // Should include capacity information
      expect(queryClient.emit).toHaveBeenCalledWith('room:users', expect.objectContaining({
        roomId: 'surgery:room-1',
        users: expect.any(Array),
        capacity: {
          current: 2,
          max: 3,
          percentageUsed: 67, // 2/3 = 66.666... rounded to 67
        },
      }));
    });

    it('should show 0% capacity for empty room', async () => {
      const client = createMockClient('user1', 'socket-1');
      gateway.handleConnection(client as Socket);

      await gateway.handleQueryRoomUsers(
        { roomId: 'surgery:room-1' },
        client as any,
      );

      expect(client.emit).toHaveBeenCalledWith('room:users', expect.objectContaining({
        roomId: 'surgery:room-1',
        users: [],
        capacity: {
          current: 0,
          max: 3,
          percentageUsed: 0,
        },
      }));
    });

    it('should show 100% capacity for full room', async () => {
      // Fill room to capacity (admin_panel limit 2)
      for (let i = 1; i <= 2; i++) {
        const client = createMockClient(`user${i}`, `socket-${i}`);
        gateway.handleConnection(client as Socket);
        const joinDto: JoinRoomDto = { roomId: 'admin_panel:panel-1' };
        await gateway.handleJoinRoom(joinDto, client as any);
      }

      // Query room users
      const queryClient = createMockClient('user3', 'socket-3');
      gateway.handleConnection(queryClient as Socket);
      await gateway.handleQueryRoomUsers(
        { roomId: 'admin_panel:panel-1' },
        queryClient as any,
      );

      expect(queryClient.emit).toHaveBeenCalledWith('room:users', expect.objectContaining({
        roomId: 'admin_panel:panel-1',
        capacity: {
          current: 2,
          max: 2,
          percentageUsed: 100,
        },
      }));
    });
  });

  describe('SocketGatewayConfigService - getRoomLimits()', () => {
    it('should return configured room limits', () => {
      const limits = configService.getRoomLimits();

      expect(limits).toEqual({
        surgery: 3,
        admin_panel: 2,
        chat: 5,
        default: 4,
      });
    });

    it('should return correct limit for surgery resource type', () => {
      const limits = configService.getRoomLimits();
      expect(limits.surgery).toBe(3);
    });

    it('should return correct limit for admin_panel resource type', () => {
      const limits = configService.getRoomLimits();
      expect(limits.admin_panel).toBe(2);
    });

    it('should return default limit fallback', () => {
      const limits = configService.getRoomLimits();
      expect(limits.default).toBe(4);
    });
  });
});
