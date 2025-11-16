import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { HeartbeatDto } from './socket-gateway.dto';

/**
 * Test Suite: Task 9.2.6 - Heartbeat Handler Unit Tests
 * 
 * Focus: Activity Tracking - Heartbeat Reception
 * 
 * Tests:
 * 1. Updates lastActivity in all rooms user is in
 * 2. Logs heartbeat event with correct metadata
 * 3. Handles malformed data gracefully (no throw)
 * 4. Handles missing lastActivity (uses Date.now())
 * 5. Updates multiple rooms correctly
 * 
 * TDD Approach: RED → GREEN → REFACTOR
 */
describe('CollaborationSocketGateway - Task 9.2.6: handleHeartbeat', () => {
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
   * TEST 9.2.6.1: Update lastActivity in all rooms
   * 
   * Verifica che l'heartbeat aggiorni lastActivity per l'utente
   * in TUTTE le stanze in cui è presente
   */
  describe('Update lastActivity', () => {
    it('should update lastActivity in all rooms user is in', async () => {
      // ARRANGE
      const userId = 'user-123';
      const username = 'Dr. Smith';
      const socketId = 'socket-abc-123';
      const lastActivity = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username },
        },
      } as unknown as Socket;

      // Setup: User is in 2 rooms
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      
      const room1Users = new Map();
      room1Users.set(socketId, {
        socketId,
        userId,
        username,
        lastActivity: Date.now() - 60000, // 1 minute ago
      });
      roomUsers.set('room-1', room1Users);

      const room2Users = new Map();
      room2Users.set(socketId, {
        socketId,
        userId,
        username,
        lastActivity: Date.now() - 120000, // 2 minutes ago
      });
      roomUsers.set('room-2', room2Users);

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT
      await gateway.handleHeartbeat(heartbeatDto, mockClient);

      // ASSERT: lastActivity updated in both rooms
      const updatedRoom1User = roomUsers.get('room-1')?.get(socketId);
      const updatedRoom2User = roomUsers.get('room-2')?.get(socketId);

      expect(updatedRoom1User?.lastActivity).toBe(lastActivity);
      expect(updatedRoom2User?.lastActivity).toBe(lastActivity);
    });

    it('should update only the specific user in shared rooms', async () => {
      // ARRANGE: 2 users in same room
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const socketId1 = 'socket-abc-123';
      const socketId2 = 'socket-def-456';
      const lastActivity = Date.now();

      const mockClient1 = {
        id: socketId1,
        data: {
          user: { userId: userId1, username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId1, {
        socketId: socketId1,
        userId: userId1,
        lastActivity: Date.now() - 60000,
      });
      roomUsersMap.set(socketId2, {
        socketId: socketId2,
        userId: userId2,
        lastActivity: Date.now() - 60000,
      });
      roomUsers.set('room-1', roomUsersMap);

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT: User 1 sends heartbeat
      await gateway.handleHeartbeat(heartbeatDto, mockClient1);

      // ASSERT: Only user 1's lastActivity updated
      const user1 = roomUsers.get('room-1')?.get(socketId1);
      const user2 = roomUsers.get('room-1')?.get(socketId2);

      expect(user1?.lastActivity).toBe(lastActivity);
      expect(user2?.lastActivity).toBeLessThan(lastActivity); // Not updated
    });
  });

  /**
   * TEST 9.2.6.2: Logging
   * 
   * Verifica che venga fatto log corretto dell'heartbeat
   */
  describe('Logging', () => {
    it('should log heartbeat event with correct metadata', async () => {
      // ARRANGE
      const userId = 'user-123';
      const username = 'Dr. Smith';
      const socketId = 'socket-abc-123';
      const lastActivity = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username },
        },
      } as unknown as Socket;

      // User in 2 rooms
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const room1Users = new Map();
      room1Users.set(socketId, { socketId, userId, username, lastActivity: Date.now() - 60000 });
      roomUsers.set('room-1', room1Users);

      const room2Users = new Map();
      room2Users.set(socketId, { socketId, userId, username, lastActivity: Date.now() - 60000 });
      roomUsers.set('room-2', room2Users);

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT
      await gateway.handleHeartbeat(heartbeatDto, mockClient);

      // ASSERT: Debug log called with correct structure
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      
      const logCall = mockLogger.debug.mock.calls[0][0];
      const logData = JSON.parse(logCall);

      expect(logData).toMatchObject({
        event: 'HEARTBEAT_RECEIVED',
        userId,
        lastActivity,
        updatedRoomsCount: 2,
      });
      expect(logData.timestamp).toBeDefined();
    });

    it('should log zero rooms when user is not in any room', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const lastActivity = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      // User not in any room
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      roomUsers.clear();

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT
      await gateway.handleHeartbeat(heartbeatDto, mockClient);

      // ASSERT
      const logCall = mockLogger.debug.mock.calls[0][0];
      const logData = JSON.parse(logCall);

      expect(logData.updatedRoomsCount).toBe(0);
    });
  });

  /**
   * TEST 9.2.6.3: Resilient Error Handling
   * 
   * Verifica che gli errori non vengano thrown ma solo loggati
   */
  describe('Error Handling', () => {
    it('should handle malformed data gracefully (no throw)', async () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-abc-123',
        data: {
          user: { userId: 'user-123', username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      // Setup room to trigger iteration that will fail
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set('socket-abc-123', {
        socketId: 'socket-abc-123',
        userId: 'user-123',
        lastActivity: Date.now(),
      });
      roomUsers.set('room-1', roomUsersMap);

      // Mock entries() to throw error
      const originalEntries = roomUsers.entries;
      jest.spyOn(roomUsers, 'entries').mockImplementation(() => {
        throw new Error('Simulated error in iteration');
      });

      const validDto: HeartbeatDto = { lastActivity: Date.now() };

      // ACT & ASSERT: Should not throw
      await expect(
        gateway.handleHeartbeat(validDto, mockClient),
      ).resolves.not.toThrow();

      // Should log error
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const errorLog = JSON.parse(mockLogger.error.mock.calls[0][0]);
      expect(errorLog.event).toBe('HEARTBEAT_ERROR');
      expect(errorLog.error).toBe('Simulated error in iteration');

      // Restore
      roomUsers.entries = originalEntries;
    });

    it('should use Date.now() when lastActivity is missing', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const beforeTime = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, {
        socketId,
        userId,
        lastActivity: Date.now() - 60000,
      });
      roomUsers.set('room-1', roomUsersMap);

      const emptyDto = {} as HeartbeatDto; // Missing lastActivity

      // ACT
      await gateway.handleHeartbeat(emptyDto, mockClient);

      const afterTime = Date.now();

      // ASSERT: lastActivity should be set to current time
      const user = roomUsers.get('room-1')?.get(socketId);
      expect(user?.lastActivity).toBeGreaterThanOrEqual(beforeTime);
      expect(user?.lastActivity).toBeLessThanOrEqual(afterTime);
    });

    it('should handle client with no user data', async () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-abc-123',
        data: {}, // No user data
      } as unknown as Socket;

      const heartbeatDto: HeartbeatDto = { lastActivity: Date.now() };

      // ACT & ASSERT: Should not throw
      await expect(
        gateway.handleHeartbeat(heartbeatDto, mockClient),
      ).resolves.not.toThrow();

      // Should log with undefined userId
      const logCall = mockLogger.debug.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.userId).toBeUndefined();
    });
  });

  /**
   * TEST 9.2.6.4: Edge Cases
   * 
   * Verifica comportamenti edge case
   */
  describe('Edge Cases', () => {
    it('should handle user in zero rooms', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const lastActivity = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      // Empty roomUsers
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      roomUsers.clear();

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT
      await gateway.handleHeartbeat(heartbeatDto, mockClient);

      // ASSERT: Should complete without error
      expect(mockLogger.debug).toHaveBeenCalled();
      const logData = JSON.parse(mockLogger.debug.mock.calls[0][0]);
      expect(logData.updatedRoomsCount).toBe(0);
    });

    it('should handle user in many rooms (scalability)', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const lastActivity = Date.now();

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username: 'Dr. Smith' },
        },
      } as unknown as Socket;

      // User in 10 rooms
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      for (let i = 0; i < 10; i++) {
        const roomUsersMap = new Map();
        roomUsersMap.set(socketId, {
          socketId,
          userId,
          lastActivity: Date.now() - 60000,
        });
        roomUsers.set(`room-${i}`, roomUsersMap);
      }

      const heartbeatDto: HeartbeatDto = { lastActivity };

      // ACT
      await gateway.handleHeartbeat(heartbeatDto, mockClient);

      // ASSERT: All 10 rooms updated
      const logData = JSON.parse(mockLogger.debug.mock.calls[0][0]);
      expect(logData.updatedRoomsCount).toBe(10);

      // Verify all rooms have updated lastActivity
      for (let i = 0; i < 10; i++) {
        const user = roomUsers.get(`room-${i}`)?.get(socketId);
        expect(user?.lastActivity).toBe(lastActivity);
      }
    });
  });
});
