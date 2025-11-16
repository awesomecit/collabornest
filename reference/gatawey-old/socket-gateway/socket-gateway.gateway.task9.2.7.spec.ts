import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { Logger } from '@nestjs/common';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';

/**
 * Test Suite: Task 9.2.7 - Sweep Job Unit Tests
 * 
 * Focus: Activity Tracking - Lock TTL Enforcement
 * 
 * Tests:
 * 1. Sweep job starts/stops correctly with lifecycle hooks
 * 2. Detects inactive users correctly
 * 3. Emits warning at correct time (TTL - warningTime)
 * 4. Releases locks after TTL expiry
 * 5. Logs sweep statistics
 * 6. Handles edge cases (no users, all active, etc.)
 * 
 * TDD Approach: RED → GREEN → REFACTOR
 */
describe('CollaborationSocketGateway - Task 9.2.7: Sweep Job', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockServer: any;

  beforeEach(async () => {
    // Use centralized mocks (DRY principle)
    mockConfigService = createMockConfigService() as any;
    
    // Mock activity tracking config
    mockConfigService.getActivityTrackingConfig = jest.fn().mockReturnValue({
      lockTTL: 3 * 60 * 60 * 1000, // 3 hours
      warningTime: 15 * 60 * 1000, // 15 minutes
      sweepInterval: 60 * 1000, // 1 minute
      heartbeatInterval: 60 * 1000, // 1 minute
    });

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

    // Mock server for event emission
    mockServer = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Cleanup sweep job timer if running
    const timer = (gateway as any).sweepJobTimer;
    if (timer) {
      clearInterval(timer);
    }
  });

  /**
   * TEST 9.2.7.1: Lifecycle Hooks
   * 
   * Verifica che il timer del sweep job venga avviato e fermato correttamente
   */
  describe('Lifecycle Hooks', () => {
    it('should start sweep job timer on afterInit', () => {
      // ARRANGE
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      // ACT
      gateway.afterInit({} as any);

      // ASSERT: Timer created with correct interval (60000ms = 1 minute)
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 1000,
      );

      // Verify startup log
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_STARTED';
      });
      expect(logCall).toBeDefined();

      const logData = JSON.parse(logCall![0]);
      expect(logData).toMatchObject({
        event: 'SWEEP_JOB_STARTED',
        sweepInterval: 60 * 1000,
        lockTTL: 3 * 60 * 60 * 1000,
        warningTime: 15 * 60 * 1000,
      });

      jest.useRealTimers();
    });

    it('should stop sweep job timer on onApplicationShutdown', async () => {
      // ARRANGE
      jest.useFakeTimers();
      gateway.afterInit({} as any); // Start timer

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // ACT
      await gateway.onApplicationShutdown();

      // ASSERT: Timer cleared
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Verify shutdown log
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_STOPPED';
      });
      expect(logCall).toBeDefined();

      jest.useRealTimers();
    });

    it('should handle shutdown when timer not running', async () => {
      // ARRANGE: No timer started
      // Verify timer property is undefined
      expect((gateway as any).sweepJobTimer).toBeUndefined();

      // ACT & ASSERT: Should not throw
      await expect(gateway.onApplicationShutdown()).resolves.not.toThrow();
      
      // Timer should still be undefined (no timer was created or cleared)
      expect((gateway as any).sweepJobTimer).toBeUndefined();
    });
  });

  /**
   * TEST 9.2.7.2: Inactivity Detection
   * 
   * Verifica che lo sweep job rilevi correttamente gli utenti inattivi
   */
  describe('Inactivity Detection', () => {
    it('should detect inactive user and emit warning', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000; // 3 hours
      const warningTime = 15 * 60 * 1000; // 15 minutes
      const warningThreshold = lockTTL - warningTime; // 2h 45m

      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const username = 'Dr. Smith';

      // User inactive for 2h 46m (just past warning threshold)
      const lastActivity = now - warningThreshold - 60000; // 2h 46m ago

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, {
        socketId,
        userId,
        username,
        lastActivity,
      });
      roomUsers.set('room-1', roomUsersMap);

      // Mock Date.now() to control time
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: Warning emitted
      expect(mockServer.to).toHaveBeenCalledWith(socketId);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:expiring_soon',
        expect.objectContaining({
          remainingTime: expect.any(Number),
        }),
      );

      // Verify warning log
      const warnCall = mockLogger.warn.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'LOCK_EXPIRING_SOON';
      });
      expect(warnCall).toBeDefined();

      const warnData = JSON.parse(warnCall![0]);
      expect(warnData).toMatchObject({
        event: 'LOCK_EXPIRING_SOON',
        userId,
        username,
        roomId: 'room-1',
      });
    });

    it('should detect expired lock and release it', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000; // 3 hours

      const userId = 'user-123';
      const socketId = 'socket-abc-123';
      const username = 'Dr. Smith';

      // User inactive for 3h 1m (expired)
      const lastActivity = now - lockTTL - 60000;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, {
        socketId,
        userId,
        username,
        lastActivity,
      });
      roomUsers.set('room-1', roomUsersMap);

      // Mock Date.now()
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // Mock releaseAllLocksForUser (tested separately)
      const releaseAllLocksForUserSpy = jest.spyOn(
        gateway as any,
        'releaseAllLocksForUser',
      ).mockReturnValue([]);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: Locks released
      expect(releaseAllLocksForUserSpy).toHaveBeenCalledWith(
        socketId,
        userId,
        'INACTIVITY_TIMEOUT',
      );

      // Verify lock:expired emitted to user
      expect(mockServer.to).toHaveBeenCalledWith(socketId);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:expired',
        { reason: 'INACTIVITY_TIMEOUT' },
      );

      // Verify lock:released broadcast to room
      expect(mockServer.in).toHaveBeenCalledWith('room-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:released',
        expect.objectContaining({
          userId,
          username,
          reason: 'INACTIVITY_TIMEOUT',
          roomId: 'room-1',
        }),
      );

      // Verify expiry log
      const warnCall = mockLogger.warn.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'LOCK_EXPIRED_INACTIVITY';
      });
      expect(warnCall).toBeDefined();
    });

    it('should not warn or expire active users', () => {
      // ARRANGE
      const now = Date.now();
      const userId = 'user-123';
      const socketId = 'socket-abc-123';

      // User active (last activity 1 minute ago)
      const lastActivity = now - 60000;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      roomUsersMap.set(socketId, {
        socketId,
        userId,
        username: 'Dr. Smith',
        lastActivity,
      });
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: No warnings, no expiry
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.in).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  /**
   * TEST 9.2.7.3: Sweep Statistics Logging
   * 
   * Verifica che lo sweep job loggi statistiche corrette
   */
  describe('Sweep Statistics', () => {
    it('should log statistics when warnings issued', () => {
      // ARRANGE
      const now = Date.now();
      const warningThreshold = 3 * 60 * 60 * 1000 - 15 * 60 * 1000; // 2h 45m

      // 2 users need warning
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      
      roomUsersMap.set('socket-1', {
        socketId: 'socket-1',
        userId: 'user-1',
        username: 'Dr. Smith',
        lastActivity: now - warningThreshold - 60000,
      });
      roomUsersMap.set('socket-2', {
        socketId: 'socket-2',
        userId: 'user-2',
        username: 'Dr. Jones',
        lastActivity: now - warningThreshold - 60000,
      });
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: Statistics logged
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_COMPLETED';
      });
      expect(logCall).toBeDefined();

      const logData = JSON.parse(logCall![0]);
      expect(logData).toMatchObject({
        event: 'SWEEP_JOB_COMPLETED',
        totalUsers: 2,
        warningsIssued: 2,
        locksReleased: 0,
      });
    });

    it('should log statistics when locks released', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000;

      // 3 users expired
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      
      for (let i = 1; i <= 3; i++) {
        roomUsersMap.set(`socket-${i}`, {
          socketId: `socket-${i}`,
          userId: `user-${i}`,
          username: `Dr. User${i}`,
          lastActivity: now - lockTTL - 60000,
        });
      }
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(gateway as any, 'releaseAllLocksForUser').mockReturnValue([]);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_COMPLETED';
      });
      expect(logCall).toBeDefined();

      const logData = JSON.parse(logCall![0]);
      expect(logData).toMatchObject({
        event: 'SWEEP_JOB_COMPLETED',
        totalUsers: 3,
        warningsIssued: 0,
        locksReleased: 3,
      });
    });

    it('should not log statistics when no activity detected', () => {
      // ARRANGE
      const now = Date.now();

      // All users active
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      
      roomUsersMap.set('socket-1', {
        socketId: 'socket-1',
        userId: 'user-1',
        username: 'Dr. Smith',
        lastActivity: now - 60000, // 1 min ago
      });
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: No SWEEP_JOB_COMPLETED log (only if activity detected)
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_COMPLETED';
      });
      expect(logCall).toBeUndefined();
    });
  });

  /**
   * TEST 9.2.7.4: Edge Cases
   * 
   * Verifica comportamenti edge case
   */
  describe('Edge Cases', () => {
    it('should handle empty roomUsers gracefully', () => {
      // ARRANGE
      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      roomUsers.clear();

      // ACT & ASSERT: Should not throw
      expect(() => (gateway as any).cleanupStaleLocks()).not.toThrow();

      // No logs expected
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should handle multiple users in multiple rooms', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;

      // Room 1: 2 users (1 expired, 1 active)
      const room1Users = new Map();
      room1Users.set('socket-1', {
        socketId: 'socket-1',
        userId: 'user-1',
        username: 'Dr. Smith',
        lastActivity: now - lockTTL - 60000, // Expired
      });
      room1Users.set('socket-2', {
        socketId: 'socket-2',
        userId: 'user-2',
        username: 'Dr. Jones',
        lastActivity: now - 60000, // Active
      });
      roomUsers.set('room-1', room1Users);

      // Room 2: 1 user (warning needed)
      const room2Users = new Map();
      room2Users.set('socket-3', {
        socketId: 'socket-3',
        userId: 'user-3',
        username: 'Dr. Brown',
        lastActivity: now - (lockTTL - 15 * 60 * 1000) - 60000, // Warning
      });
      roomUsers.set('room-2', room2Users);

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(gateway as any, 'releaseAllLocksForUser').mockReturnValue([]);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: 1 warning, 1 expiry
      const logCall = mockLogger.log.mock.calls.find((call) => {
        const parsed = JSON.parse(call[0]);
        return parsed.event === 'SWEEP_JOB_COMPLETED';
      });
      expect(logCall).toBeDefined();

      const logData = JSON.parse(logCall![0]);
      expect(logData).toMatchObject({
        totalUsers: 3,
        warningsIssued: 1,
        locksReleased: 1,
      });
    });

    it('should handle user exactly at warning threshold', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000;
      const warningTime = 15 * 60 * 1000;
      const warningThreshold = lockTTL - warningTime;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      
      // User exactly at warning threshold (should warn)
      roomUsersMap.set('socket-1', {
        socketId: 'socket-1',
        userId: 'user-1',
        username: 'Dr. Smith',
        lastActivity: now - warningThreshold,
      });
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: Warning issued
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:expiring_soon',
        expect.any(Object),
      );
    });

    it('should handle user exactly at expiry threshold', () => {
      // ARRANGE
      const now = Date.now();
      const lockTTL = 3 * 60 * 60 * 1000;

      const roomUsers = (gateway as any).roomUsers as Map<string, Map<string, any>>;
      const roomUsersMap = new Map();
      
      // User exactly at expiry threshold (should expire)
      roomUsersMap.set('socket-1', {
        socketId: 'socket-1',
        userId: 'user-1',
        username: 'Dr. Smith',
        lastActivity: now - lockTTL,
      });
      roomUsers.set('room-1', roomUsersMap);

      jest.spyOn(Date, 'now').mockReturnValue(now);
      jest.spyOn(gateway as any, 'releaseAllLocksForUser').mockReturnValue([]);

      // ACT
      (gateway as any).cleanupStaleLocks();

      // ASSERT: Lock released
      expect(mockServer.emit).toHaveBeenCalledWith(
        'lock:expired',
        expect.any(Object),
      );
    });
  });
});
