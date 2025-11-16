import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import {
  createMockConfigService,
  createMockResourceValidationService,
} from './test-mocks';

/**
 * Task 9.3: Auto-Release Lock on Disconnect
 * 
 * TDD Approach: Write tests FIRST, then implement
 * 
 * Focus: Lock cleanup when user disconnects (voluntary, timeout, error, network interruption)
 * 
 * Test Coverage:
 * 1. Release all locks on disconnect
 * 2. Broadcast lock:released to room with subResourceId
 * 3. Remove user from rooms + broadcast user:left
 * 4. Cleanup empty rooms automatically
 * 5. Handle multiple locks in multiple rooms
 * 6. Resilient error handling (disconnect completes even if release fails)
 * 
 * Real Surgery Management Tab IDs (from surgery-management-tabs.types.ts):
 * - 'data-tab' (Dati Base)
 * - 'anesthesis-tab' (Anestesia)
 * - 'patient-path-tab' (Percorso Paziente)
 * - 'operators-tab' (Operatori)
 * - 'diagnosis-tab' (Diagnosi)
 * - 'validation-tab' (Validazione)
 * ... etc (18 total tabs)
 */
describe('CollaborationSocketGateway - Task 9.3: Auto-Release on Disconnect', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockServer: any;

  beforeEach(async () => {
    mockConfigService = createMockConfigService() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationSocketGateway,
        {
          provide: SocketGatewayConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SurgeryManagementService,
          useValue: createMockResourceValidationService(),
        },
      ],
    }).compile();

    gateway = module.get<CollaborationSocketGateway>(CollaborationSocketGateway);
    
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;
    
    (gateway as any).logger = mockLogger;

    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Lock Release on Disconnect', () => {
    it('should release all locks when user disconnects', async () => {
      // ARRANGE
      const userId = 'user-123';
      const username = 'Dr. Smith';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: {
          user: { userId, username },
        },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      // Setup: User has 2 locks (using real surgery-management tab IDs)
      const subResourceLocks = (gateway as any).subResourceLocks as Map<string, any>;
      
      subResourceLocks.set('surgery-management:uuid1:anesthesis-tab', {
        lockKey: 'surgery-management:uuid1:anesthesis-tab',
        socketId,
        userId,
        username,
        lockedAt: Date.now(),
        resourceType: 'surgery-management',
        resourceUuid: 'uuid1',
        subResourceId: 'anesthesis-tab', // Real tab ID
      });

      subResourceLocks.set('surgery-management:uuid1:patient-path-tab', {
        lockKey: 'surgery-management:uuid1:patient-path-tab',
        socketId,
        userId,
        username,
        lockedAt: Date.now(),
        resourceType: 'surgery-management',
        resourceUuid: 'uuid1',
        subResourceId: 'patient-path-tab', // Real tab ID
      });

      // Setup: User in room
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, { socketId, userId, username });
      roomUsers.set('surgery-management:uuid1', roomUsersMap);

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT: Locks released
      expect(subResourceLocks.size).toBe(0);

      // ASSERT: lock:released emitted for both locks
      expect(mockServer.in).toHaveBeenCalledWith('surgery-management:uuid1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:released',
        expect.objectContaining({
          userId,
          username,
          reason: 'DISCONNECT',
          roomId: 'surgery-management:uuid1',
        }),
      );

      // Should emit 2 times (one per lock)
      const lockReleasedCalls = mockServer.emit.mock.calls.filter(
        call => call[0] === 'lock:released',
      );
      expect(lockReleasedCalls.length).toBe(2);
    });

    it('should broadcast lock:released with correct subResourceId', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: { user: { userId, username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      const subResourceLocks = (gateway as any).subResourceLocks as Map<string, any>;
      subResourceLocks.set('surgery-management:uuid1:anesthesis-tab', {
        lockKey: 'surgery-management:uuid1:anesthesis-tab',
        socketId,
        userId,
        username: 'Dr. Smith',
        resourceType: 'surgery-management',
        resourceUuid: 'uuid1',
        subResourceId: 'anesthesis-tab', // Real tab ID
      });

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, { socketId, userId, username: 'Dr. Smith' });
      roomUsers.set('surgery-management:uuid1', roomUsersMap);

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:released',
        expect.objectContaining({
          subResourceId: 'anesthesis-tab',
        }),
      );
    });
  });

  describe('Room Cleanup', () => {
    it('should remove user from room and broadcast user:left', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: { user: { userId, username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, { socketId, userId, username: 'Dr. Smith' });
      roomUsersMap.set('socket-other', { socketId: 'socket-other', userId: 'user-456', username: 'Dr. Jones' });
      roomUsers.set('surgery-management:uuid1', roomUsersMap);

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT: User removed from room
      expect(roomUsersMap.has(socketId)).toBe(false);
      expect(roomUsersMap.size).toBe(1); // Only other user remains

      // ASSERT: user:left emitted (via client.to(roomId).emit, not server.emit)
      expect((mockClient as any).emit).toHaveBeenCalledWith(
        'user_left', // Note: event is 'user_left' not 'user:left'
        expect.objectContaining({
          roomId: 'surgery-management:uuid1',
          userId,
          username: 'Dr. Smith',
          reason: 'disconnect',
        }),
      );
    });

    it('should delete room when last user disconnects', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: { user: { userId, username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, { socketId, userId, username: 'Dr. Smith' });
      roomUsers.set('surgery-management:uuid1', roomUsersMap);

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT: Room deleted (empty)
      expect(roomUsers.has('surgery-management:uuid1')).toBe(false);

      // ASSERT: ROOM_DELETED_EMPTY logged
      const logCalls = mockLogger.log.mock.calls;
      const roomDeletedLog = logCalls.find(call => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'ROOM_DELETED_EMPTY';
      });
      expect(roomDeletedLog).toBeDefined();
    });
  });

  describe('Multiple Locks and Rooms', () => {
    it('should handle user with locks in multiple rooms', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: { user: { userId, username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      // User in 2 rooms
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      
      const room1Users = new Map();
      room1Users.set(socketId, { socketId, userId, username: 'Dr. Smith' });
      roomUsers.set('surgery-management:uuid1', room1Users);

      const room2Users = new Map();
      room2Users.set(socketId, { socketId, userId, username: 'Dr. Smith' });
      roomUsers.set('surgery-management:uuid2', room2Users);

      // User has locks in both rooms (using real surgery-management tab IDs)
      const subResourceLocks = (gateway as any).subResourceLocks as Map<string, any>;
      subResourceLocks.set('surgery-management:uuid1:anesthesis-tab', {
        lockKey: 'surgery-management:uuid1:anesthesis-tab',
        socketId,
        userId,
        username: 'Dr. Smith',
        resourceType: 'surgery-management',
        resourceUuid: 'uuid1',
        subResourceId: 'anesthesis-tab', // Real tab ID: Anestesia
      });

      subResourceLocks.set('surgery-management:uuid2:patient-path-tab', {
        lockKey: 'surgery-management:uuid2:patient-path-tab',
        socketId,
        userId,
        username: 'Dr. Smith',
        resourceType: 'surgery-management',
        resourceUuid: 'uuid2',
        subResourceId: 'patient-path-tab', // Real tab ID: Percorso Paziente
      });

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT: All locks released
      expect(subResourceLocks.size).toBe(0);

      // ASSERT: User removed from both rooms
      expect(roomUsers.has('surgery-management:uuid1')).toBe(false);
      expect(roomUsers.has('surgery-management:uuid2')).toBe(false);

      // ASSERT: lock:released emitted to both rooms
      expect(mockServer.in).toHaveBeenCalledWith('surgery-management:uuid1');
      expect(mockServer.in).toHaveBeenCalledWith('surgery-management:uuid2');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and not throw', async () => {
      // ARRANGE
      const mockClient = {
        id: 'socket-abc-123',
        data: { user: { userId: 'user-123', username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      // Force error by mocking releaseAllSubResourceLocks to throw
      jest.spyOn(gateway as any, 'releaseAllSubResourceLocks').mockImplementation(() => {
        throw new Error('Simulated error');
      });

      // ACT & ASSERT: Should not throw
      await expect(
        (gateway as any).onClientDisconnected(mockClient),
      ).resolves.not.toThrow();

      // ASSERT: Error logged
      expect(mockLogger.error).toHaveBeenCalled();
      const errorLog = JSON.parse(mockLogger.error.mock.calls[0][0]);
      expect(errorLog.event).toBe('DISCONNECT_CLEANUP_ERROR');
    });

    it('should log summary even when no locks to release', async () => {
      // ARRANGE
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      const mockClient = {
        id: socketId,
        data: { user: { userId, username: 'Dr. Smith' } },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      } as unknown as Socket;

      // No locks, no rooms

      // ACT
      await (gateway as any).onClientDisconnected(mockClient);

      // ASSERT: Summary logged
      const logCalls = mockLogger.log.mock.calls;
      const summaryLog = logCalls.find(call => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'DISCONNECT_CLEANUP_COMPLETED';
      });
      expect(summaryLog).toBeDefined();

      const summary = JSON.parse(summaryLog[0]);
      expect(summary.locksReleased).toBe(0);
      expect(summary.roomsLeft).toBe(0);
    });
  });
});
