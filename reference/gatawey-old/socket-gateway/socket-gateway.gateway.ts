import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import {
  // ConnectionInfo,
  JoinRoomDto,
  LeaveRoomDto,
  QueryRoomUsersDto,
  RoomUserDto,
  RoomJoinedDto,
  UserJoinedRoomDto,
  RoomLeftDto,
  UserLeftRoomDto,
  RoomUsersDto,
  RoomJoinRejectedDto,
  RoomCapacityWarningDto,
  SocketErrorCategory,
  // SocketEventName,
  RateLimitExceededDto,
  ConnectionBannedDto,
  // Resource collaboration DTOs (generic, riusabili per qualsiasi risorsa)
  ResourceJoinDto,
  ResourceLeaveDto,
  ResourceJoinRejectedDto,
  ResourceType,
  // Generic Resource API DTOs
  GenericResourceJoinDto,
  GenericResourceLeaveDto,
  GenericSubResourceLockDto,
  GenericSubResourceUnlockDto,
  // SubResource Lock DTOs (generic parent-child lock system)
  SubResourceLockDto,
  SubResourceUnlockDto,
  SubResourceLockAcquiredDto,
  SubResourceLockDeniedDto,
  SubResourceLockedDto,
  SubResourceLockReleasedDto,
  SubResourceUnlockedDto,
  SubResourceLock,
  // Presence Management DTOs
  SetCurrentSubResourceDto,
  PresenceUpdateDto,
  PresenceEventType,
  // Activity Tracking & Lock TTL DTOs
  HeartbeatDto,
  LockExpiringSoonDto,
  LockExpiredDto,
  LockReleasedDto,
  // Lock Timeout & Warning DTOs
  LockExtendDto,
  LockExtendedDto,
  // Lock Force Request DTOs
  ForceRequestDto,
  ForceRequestReceivedDto,
  ForceRequestPendingDto,
  ForceResponseDto,
  ForceRequestApprovedDto,
  ForceRequestRejectedDto,
  // Save/Revision Events DTOs
  ResourceUpdateEventDto,
  ResourceUpdatedDto,
} from './socket-gateway.dto';
import {
  TypedSocket,
  SocketException,
} from './socket-gateway.types';
import { BaseSocketGateway } from './base/base-socket-gateway';
import { RateLimiter, RateLimitConfig } from './rate-limiter';
// TOREFACTOR: (questa parte va in una classe o servizio/provider che estende il generico socket gateway) Surgery business validation
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { SurgeryManagementStatus } from '../surgery-management-revision/entities/surgery-management-revision.entity';

// TOREFACTOR: importare da bootstrap

const API_PREFIX = process.env.API_PREFIX || '/api/n';

/**
 * Force Request State
 * 
 * Tracks pending force lock requests with timeout management.
 * 
 * Lock Force Request // TOREFACTOR: nomenclatura più chiara
 */
interface ForceRequest {
  /** Unique request ID (UUID) */
  requestId: string;
  
  /** Resource type */
  resourceType: string;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User requesting force release */
  requesterId: string;
  
  /** Requester username */
  requesterUsername: string;
  
  /** Requester socket ID */
  requesterSocketId: string;
  
  /** Current lock owner user ID */
  ownerId: string;
  
  /** Owner username */
  ownerUsername: string;
  
  /** Owner socket ID */
  ownerSocketId: string;
  
  /** Optional message from requester */
  message?: string;
  
  /** When request was created */
  createdAt: number;
  
  /** When request expires (30s timeout) */
  expiresAt: number;
  
  /** Timeout timer reference */
  timeoutTimer: NodeJS.Timeout;
  
  /** Request status */
  status: 'pending' | 'approved' | 'rejected' | 'timeout'; // TOREFACTOR: esportare valore verità assoluta e usare nelle altre occorrenze del codice

}

/**
 * Collaboration WebSocket Gateway
 * 
 * Gateway Initialization & Lifecycle Management
 * 
 * This gateway handles real-time collaborative editing for surgery management.
 * 
 * Authentication: TOCHECK: SKIPPED (?) (internal network, no data persistence)
 * 
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/',
  path: API_PREFIX ? `${API_PREFIX}/ws/socket.io` : '/ws/socket.io',
  transports: ['websocket', 'polling'],
})
export class CollaborationSocketGateway
  extends BaseSocketGateway
  implements OnGatewayInit, OnApplicationShutdown
{

  // Expose server as public for testing (overrides protected from base)
  public server!: any;

  // Room Management: Track users in rooms
  // Map<roomId, Map<socketId, RoomUserDto>>
  private readonly roomUsers = new Map<string, Map<string, RoomUserDto>>();

  // ============================================================================
  // Sub-Resource(Room) Lock Management
  // ============================================================================

  /**
   * Sub-Resource/Room Locks: Track locks on child resources
   * 
   * Architecture:
   * - Resource: Parent entity (SurgeryManagement, SurgeryRequest, OutpatientVisit, etc.)
   * - Sub-Resource: Child entity (Anestesia, Paziente, Anagrafica, etc.)
   * - Hierarchy: Resource → Sub-Resource (no nesting allowed)
   * 
   * Lock Key Format: {resourceType}:{resourceUuid}:{subResourceId}
   * 
   * Examples:
   * - surgery-management:550e8400-...:anestesia
   * - surgery-management:550e8400-...:paziente
   * - patient:12345:anagrafica
   * 
   * Map<lockKey, SubResourceLock>
   */
  private readonly subResourceLocks = new Map<string, SubResourceLock>();

  // ============================================================================
  // Lock Timeout & Warning Management
  // ============================================================================

  /**
   * Lock Timer Configuration
   * 
   * - Lock TTL: 3 hours (10800000ms)
   * - Warning: 15 minutes before expiry (900000ms before TTL)
   * - Warning triggers at: 2h 45m (9900000ms)
   */
  private readonly LOCK_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
  private readonly WARNING_BEFORE_MS = 15 * 60 * 1000; // 15 minutes
  private readonly WARNING_AT_MS = this.LOCK_TTL_MS - this.WARNING_BEFORE_MS; // 2h 45m

  /**
   * Lock Timers: Track expiry and warning timers for each lock
   * 
   * Map<lockKey, { expiryTimer, warningTimer, expiresAt }>
   */
  private readonly lockTimers = new Map<string, {
    expiryTimer: NodeJS.Timeout;
    warningTimer: NodeJS.Timeout;
    expiresAt: number;
  }>();

  // ============================================================================
  // Force Request Configuration & State
  // ============================================================================

  /**
   * Force Request Timeout: 30 seconds for owner to respond
   */
  private readonly FORCE_REQUEST_TIMEOUT_MS = 30 * 1000; // 30 seconds

  /**
   * Force Requests: Track pending force lock requests
   * 
   * Map<requestId, ForceRequest>
   * 
   * Cleanup triggers:
   * - Owner approves/rejects
   * - Timeout (30s)
   * - Owner disconnects
   * - Lock is released manually before response
   */
  private readonly forceRequests = new Map<string, ForceRequest>();

  // ============================================================================
  // Rate Limiting Configuration & State
  // ============================================================================

  /**
   * Rate Limiting Configuration
   * 
   * Per-event rate limits with progressive penalties:
   * - room:join: 2 requests per 5s (prevent spam joining)
   * - surgery:lock: 5 requests per second (prevent lock spam)
   * - default: 10 requests per second (general protection)
   * 
   * Progressive penalties:
   * - 3 violations → warning + disconnect
   * - 5 violations → ban for 5 minutes
   */
  private readonly RATE_LIMITS: Record<string, RateLimitConfig> = { // TOREFACTOR: usare solo una nomenclatura room o resource mai surgery
    'room:join': { limit: 2, window: 5000 },      // 2 requests per 5 seconds
    'surgery:lock': { limit: 5, window: 1000 },   // 5 requests per second
    default: { limit: 10, window: 1000 },         // 10 requests per second (fallback)
  };

  /**
   * Rate limiter instances per socketId + event
   * Map<socketId, Map<eventType, RateLimiter>>
   */
  private readonly rateLimiters = new Map<string, Map<string, RateLimiter>>();

  /**
   * Violation tracking for progressive penalties
   * Map<socketId, { count: number, lastViolation: number }>
   */
  private readonly violations = new Map<string, { count: number; lastViolation: number }>();

  /**
   * Banned users tracking
   * Map<socketId, { bannedUntil: number, reason: string }>
   */
  private readonly bannedUsers = new Map<string, { bannedUntil: number; reason: string }>();

  /**
   * Violation expiry time: 5 minutes
   * After 5 minutes without violations, count resets
   */
  private readonly VIOLATION_EXPIRY = 5 * 60 * 1000; // 5 minutes

  /**
   * Ban duration: 5 minutes
   */
  private readonly BAN_DURATION = 5 * 60 * 1000; // 5 minutes

  // ============================================================================
  // Activity Tracking & Lock TTL State
  // ============================================================================

  /**
   * Sweep job timer for checking stale locks
   * Runs every sweepInterval (default: 1 minute) to detect inactive users
   */
  private sweepJobTimer?: NodeJS.Timeout;


  constructor(
    configService: SocketGatewayConfigService,
    private readonly surgeryManagementService: SurgeryManagementService, // Area 7.1: Business validation
  ) {
    super(configService, CollaborationSocketGateway.name);
  }

  // ============================================================================
  // Abstract Hooks Implementation (from BaseSocketGateway)
  // ============================================================================

  
  /**
   * Hook: Called after client authentication
   * Resource-specific: No additional initialization needed yet
   */
  protected onClientAuthenticated(client: TypedSocket): void {
    this.logger.log(`[WebSocket] Resource gateway: user ${client.data.user.username} authenticated`);
    // Future: Could load user's active resources, preferences, etc.
  }

  /**
   * Hook: Called before client disconnect
   * Resource-specific: Cleanup user from all rooms + rate limit data
   */
  protected onClientDisconnecting(client: TypedSocket): void {
    this.cleanupUserRooms(client);
    this.cleanupRateLimitData(client.id); // TASK 10.4: Cleanup rate limiting data
  }

  /**
   * TASK 9.3: Public wrapper for testing
   * Allows unit tests to trigger disconnect cleanup logic
   */
  public onClientDisconnected(client: TypedSocket): Promise<void> {
    return Promise.resolve(this.onClientDisconnecting(client));
  }

  // ============================================================================
  // Resource-Specific Room Cleanup
  // ============================================================================

  /**
   * Cleanup user from all resource rooms on disconnect
   * Extracted from handleDisconnect (resource-specific logic)
   * 
   * TASK 9.3: Enhanced with error handling and lock:released broadcast
   */
  private cleanupUserRooms(client: TypedSocket): void {
    const userId = client.data?.user?.userId;
    const username = client.data?.user?.username;

    // Leave all rooms and notify other users
    const roomsLeft: string[] = [];
    let releasedLocks: SubResourceLock[] = [];

    try {

    for (const [roomId, users] of this.roomUsers.entries()) {
      if (users.has(client.id)) {
        // Remove user from room tracking
        users.delete(client.id);

        // Add to rooms left list
        roomsLeft.push(roomId);

        // Notify other room members (using 'user_left' for consistency with manual leave)
        client.to(roomId).emit('user_left', {
          roomId,
          userId,
          username,
          reason: 'disconnect',
        } as UserLeftRoomDto);

        // Area 7.2: Broadcast presence update to remaining users (disconnected user won't receive it)
        const remainingUsers = Array.from(users.values());
        const presenceUpdate: PresenceUpdateDto = {
          roomId,
          users: remainingUsers,
          eventType: 'user_left',
          triggerUserId: userId,
          timestamp: Date.now(),
        };
        this.server.to(roomId).emit('presence:updated', presenceUpdate);

        // Clean up empty room entries
        if (users.size === 0) {
          this.roomUsers.delete(roomId);
          
          this.logger.log(JSON.stringify({
            event: 'ROOM_DELETED_EMPTY',
            roomId,
            reason: 'last_user_disconnected',
            timestamp: new Date().toISOString(),
          }));
        }
      }
    }

      // Area 7.3: Auto-release all sub-resource locks held by user
      releasedLocks = this.releaseAllSubResourceLocks(client.id);
    if (releasedLocks.length > 0) {
      const releasedAt = Date.now();

      // Broadcast unlock notifications to all rooms
      for (const lock of releasedLocks) {
        const roomId = `${lock.resourceType}:${lock.resourceUuid}`;
        
        // TASK 7.3: Legacy event (backward compatibility)
        const unlockedDto: SubResourceUnlockedDto = {
          resourceType: lock.resourceType,
          resourceUuid: lock.resourceUuid,
          subResourceId: lock.subResourceId,
          userId: lock.userId,
          username: lock.username,
          releasedAt,
          reason: 'disconnect',
        };
        this.server.to(roomId).emit('subresource:unlocked', unlockedDto);

        // TASK 9.3: New unified lock:released event (Activity Tracking)
        const lockReleasedDto: LockReleasedDto = {
          userId: lock.userId,
          username: lock.username,
          reason: 'DISCONNECT',
          roomId,
          subResourceId: lock.subResourceId,
        };
        this.server.in(roomId).emit('lock:released', lockReleasedDto);

        this.logger.log(JSON.stringify({
          event: 'LOCK_AUTO_RELEASED_ON_DISCONNECT',
          userId: lock.userId,
          username: lock.username,
          roomId,
          subResourceId: lock.subResourceId,
          socketId: client.id,
          timestamp: new Date().toISOString(),
        }));
      }

      this.logger.log(JSON.stringify({
        event: 'SUBRESOURCE_LOCKS_AUTO_RELEASED',
        userId,
        username,
        socketId: client.id,
        locksReleased: releasedLocks.length,
        subResources: releasedLocks.map(l => l.subResourceId),
      }));
    }

    if (roomsLeft.length > 0) {
      this.logger.log(JSON.stringify({
        event: 'USER_ROOMS_CLEANUP',
        userId,
        username,
        socketId: client.id,
        roomsLeft,
        roomCount: roomsLeft.length,
      }));
    }

      // TASK 9.3: Summary log for disconnect cleanup
      this.logger.log(JSON.stringify({
        event: 'DISCONNECT_CLEANUP_COMPLETED',
        userId,
        username,
        socketId: client.id,
        locksReleased: releasedLocks.length,
        roomsLeft: roomsLeft.length,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      // TASK 9.3: Resilient error handling - disconnect completes even if cleanup fails
      this.logger.error(JSON.stringify({
        event: 'DISCONNECT_CLEANUP_ERROR',
        userId,
        username,
        socketId: client.id,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  // ============================================================================
  // Sub-Resource Lock Helpers (Area 7.3)
  // ============================================================================

  /**
   * Generate sub-resource lock key
   * 
   * Format: {resourceType}:{resourceUuid}:{subResourceId}
   * Example: surgery-management:550e8400-...:anestesia
   * 
   * @param resourceType - Type of parent resource (e.g., 'surgery-management')
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource (e.g., 'anestesia')
   * @returns Lock key string
   */
  private getSubResourceLockKey(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
  ): string {
    return `${resourceType}:${resourceUuid}:${subResourceId}`;
  }

  /**
   * Check if sub-resource is locked
   * 
   * @param resourceType - Type of parent resource
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource
   * @returns true if locked, false otherwise
   */
  private isSubResourceLocked(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
  ): boolean {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
    return this.subResourceLocks.has(lockKey);
  }

  /**
   * Get sub-resource lock
   * 
   * @param resourceType - Type of parent resource
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource
   * @returns SubResourceLock if exists, undefined otherwise
   */
  private getSubResourceLock(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
  ): SubResourceLock | undefined {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
    return this.subResourceLocks.get(lockKey);
  }

  /**
   * Acquire sub-resource lock
   * 
   * @param resourceType - Type of parent resource
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource
   * @param userId - User ID acquiring lock
   * @param username - Username for display
   * @param socketId - Socket ID for cleanup on disconnect
   * @returns true if acquired, false if already locked
   */
  private acquireSubResourceLock(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
    userId: string,
    username: string,
    socketId: string,
  ): boolean {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);

    // Check if already locked
    if (this.subResourceLocks.has(lockKey)) {
      return false;
    }

    // Acquire lock with expiry timestamp
    const expiresAt = Date.now() + this.LOCK_TTL_MS;
    
    const lock: SubResourceLock = {
      resourceType,
      resourceUuid,
      subResourceId,
      userId,
      username,
      socketId,
      lockedAt: Date.now(),
      expiresAt, // Area 7.4: Lock expires after 3h
    };

    this.subResourceLocks.set(lockKey, lock);

    // Area 7.4: Schedule expiry and warning timers
    this.scheduleLockTimers(
      resourceType,
      resourceUuid,
      subResourceId,
      userId,
      username,
      socketId,
    );

    this.logger.log(JSON.stringify({
      event: 'SUBRESOURCE_LOCK_ACQUIRED',
      lockKey,
      userId,
      username,
      socketId,
      resourceType,
      resourceUuid,
      subResourceId,
      expiresAt,
    }));

    return true;
  }

  /**
   * Release sub-resource lock
   * 
   * @param resourceType - Type of parent resource
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource
   * @param userId - User ID releasing lock (for ownership validation)
   * @returns true if released, false if not owned by user or doesn't exist
   */
  private releaseSubResourceLock(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
    userId: string,
  ): boolean {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
    const lock = this.subResourceLocks.get(lockKey);

    // Lock doesn't exist
    if (!lock) {
      return false;
    }

    // Ownership validation
    if (lock.userId !== userId) {
      return false;
    }

    // Release lock
    this.subResourceLocks.delete(lockKey);

    // Area 7.4: Clear expiry and warning timers
    this.clearLockTimers(lockKey);

    this.logger.log(JSON.stringify({
      event: 'SUBRESOURCE_LOCK_RELEASED',
      lockKey,
      userId,
      resourceType,
      resourceUuid,
      subResourceId,
    }));

    return true;
  }

  /**
   * Release all sub-resource locks held by a socket
   * 
   * Called on disconnect to auto-release all locks.
   * 
   * @param socketId - Socket ID to release locks for
   * @returns Array of released locks (for notification)
   */
  private releaseAllSubResourceLocks(socketId: string): SubResourceLock[] {
    const releasedLocks: SubResourceLock[] = [];

    for (const [lockKey, lock] of this.subResourceLocks.entries()) {
      if (lock.socketId === socketId) {
        releasedLocks.push(lock);
        this.subResourceLocks.delete(lockKey);

        // Area 7.4: Clear timers on disconnect
        this.clearLockTimers(lockKey);

        this.logger.log(JSON.stringify({
          event: 'SUBRESOURCE_LOCK_AUTO_RELEASED',
          lockKey,
          userId: lock.userId,
          socketId,
          reason: 'disconnect',
        }));
      }
    }

    return releasedLocks;
  }

  // ============================================================================
  // AREA 7.4 - Lock Timeout & Warning Management Methods
  // ============================================================================

  /**
   * Schedule lock expiry and warning timers
   * 
   * Sets up two timers for a lock:
   * 1. Warning timer (at 2h 45m): Emits lock:expiring_soon to owner
   * 2. Expiry timer (at 3h): Auto-releases lock and broadcasts unlock
   * 
   * @param resourceType - Type of parent resource
   * @param resourceUuid - UUID of parent resource
   * @param subResourceId - Identifier of child resource
   * @param userId - User ID who owns lock
   * @param username - Username for notifications
   * @param socketId - Socket ID for targeted emit
   */
  private scheduleLockTimers(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
    userId: string,
    username: string,
    socketId: string,
  ): void {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
    const roomId = `${resourceType}:${resourceUuid}`;
    const now = Date.now();
    const expiresAt = now + this.LOCK_TTL_MS;

    // Clear existing timers (in case of extension)
    this.clearLockTimers(lockKey);

    // Schedule warning timer (at 2h 45m)
    const warningTimer = setTimeout(() => {
      // Check if lock still exists (might have been released manually)
      if (!this.subResourceLocks.has(lockKey)) {
        return; // Lock was released, no warning needed
      }

      const warningDto: LockExpiringSoonDto = {
        resourceType: resourceType as any,
        resourceUuid,
        subResourceId,
        remainingMinutes: 15,
        remainingTime: this.WARNING_BEFORE_MS,
        expiresAt,
      };

      // Emit warning to lock owner only
      this.server.to(socketId).emit('lock:expiring_soon', warningDto);

      this.logger.log(JSON.stringify({
        event: 'LOCK_EXPIRING_SOON',
        lockKey,
        userId,
        remainingMinutes: 15,
        expiresAt,
      }));
    }, this.WARNING_AT_MS);

    // Schedule expiry timer (at 3h)
    const expiryTimer = setTimeout(() => {
      // Force release lock (if still exists)
      this.forceReleaseLock(lockKey, userId, username, resourceType, resourceUuid, subResourceId, roomId, 'timeout');
    }, this.LOCK_TTL_MS);

    // Store timers
    this.lockTimers.set(lockKey, {
      expiryTimer,
      warningTimer,
      expiresAt,
    });

    this.logger.debug(JSON.stringify({
      event: 'LOCK_TIMERS_SCHEDULED',
      lockKey,
      userId,
      expiresAt,
      warningAtMs: this.WARNING_AT_MS,
      expiryAtMs: this.LOCK_TTL_MS,
    }));
  }

  /**
   * Clear lock timers
   * 
   * Cancels both warning and expiry timers for a lock.
   * Called when lock is released manually or extended.
   * 
   * @param lockKey - Lock key
   */
  private clearLockTimers(lockKey: string): void {
    const timers = this.lockTimers.get(lockKey);

    if (timers) {
      clearTimeout(timers.warningTimer);
      clearTimeout(timers.expiryTimer);
      this.lockTimers.delete(lockKey);

      this.logger.debug(JSON.stringify({
        event: 'LOCK_TIMERS_CLEARED',
        lockKey,
      }));
    }
  }

  /**
   * Force release lock (due to timeout or expiry)
   * 
   * Called by expiry timer when lock times out.
   * 
   * @param lockKey - Lock key
   * @param userId - User ID who owns lock
   * @param username - Username for notifications
   * @param resourceType - Resource type
   * @param resourceUuid - Resource UUID
   * @param subResourceId - Sub-resource ID
   * @param roomId - Room ID for broadcasts
   * @param reason - Reason for release ('timeout' | 'disconnect')
   */
  private forceReleaseLock(
    lockKey: string,
    userId: string,
    username: string,
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
    roomId: string,
    reason: 'timeout' | 'disconnect',
  ): void {
    // Check if lock still exists
    const lock = this.subResourceLocks.get(lockKey);
    if (!lock) {
      return; // Already released
    }

    // Release lock
    this.subResourceLocks.delete(lockKey);

    // Clear timers
    this.clearLockTimers(lockKey);

    // Emit lock:expired to owner
    const expiredDto: LockExpiredDto = {
      resourceType: resourceType as any,
      resourceUuid,
      subResourceId,
      reason: reason === 'disconnect' ? 'timeout' : reason, // Map 'disconnect' to 'timeout' for DTO
    };

    this.server.to(lock.socketId).emit('lock:expired', expiredDto);

    // Broadcast unlock to room
    const unlockedDto: SubResourceUnlockedDto = {
      resourceType,
      resourceUuid,
      subResourceId,
      userId,
      username,
      reason: reason === 'disconnect' ? 'timeout' : reason, // Map to valid reason
      releasedAt: Date.now(),
    };

    this.server.to(roomId).emit('resource:subresource_unlocked', unlockedDto);

    this.logger.log(JSON.stringify({
      event: 'LOCK_FORCE_RELEASED',
      lockKey,
      userId,
      reason,
    }));
  }

  /**
   * Extend lock TTL
   * 
   * Resets lock timers to full 3h TTL.
   * Called when client responds to warning with lock:extend.
   * 
   * @param resourceType - Resource type
   * @param resourceUuid - Resource UUID
   * @param subResourceId - Sub-resource ID
   * @param userId - User ID requesting extension (for ownership validation)
   * @returns New expiry timestamp if successful, undefined if lock not found or not owned
   */
  private extendLock(
    resourceType: string,
    resourceUuid: string,
    subResourceId: string,
    userId: string,
  ): number | undefined {
    const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
    const lock = this.subResourceLocks.get(lockKey);

    // Lock doesn't exist
    if (!lock) {
      return undefined;
    }

    // Ownership validation
    if (lock.userId !== userId) {
      return undefined;
    }

    // Reschedule timers (full 3h from now)
    this.scheduleLockTimers(
      resourceType,
      resourceUuid,
      subResourceId,
      userId,
      lock.username,
      lock.socketId,
    );

    const newExpiresAt = Date.now() + this.LOCK_TTL_MS;

    // Update lock expiresAt
    lock.expiresAt = newExpiresAt;
    this.subResourceLocks.set(lockKey, lock);

    this.logger.log(JSON.stringify({
      event: 'LOCK_EXTENDED',
      lockKey,
      userId,
      newExpiresAt,
    }));

    return newExpiresAt;
  }

  // ============================================================================
  // Business Logic Helpers (Area 7.1 - Surgery Management)
  // ============================================================================

  /**
   * Validate Surgery Management Access
   * 
   * Area 7.1: Business validation specifica per SurgeryManagement.
   * 
   * Verifica:
   * 1. SurgeryManagement exists
   * 2. Status allows collaboration (NOT VALIDATED, NOT CANCELLED)
   * 
   * Future: Quando serviranno altre risorse (Patient, Visit, etc.),
   * estrarre in funzione generica validateResourceAccess<T>() o
   * implementare Strategy Pattern con ResourceAccessValidator.
   * 
   * @param uuid - SurgeryManagement UUID
   * @throws SocketException if validation fails
   * @returns SurgeryManagement data if validation passes
   */
  private async validateSurgeryManagementAccess(uuid: string): Promise<any> {
    // Verify SurgeryManagement exists
    // Note: BaseService.findOne() can return array or single object depending on TypeORM version
    const surgeryResult = await this.surgeryManagementService.findOne(uuid);
    const surgery = Array.isArray(surgeryResult) ? surgeryResult[0] : surgeryResult;

    if (!surgery || !surgery.uuid) {
      throw new SocketException(
        SocketErrorCategory.NOT_FOUND,
        'SURGERY_NOT_FOUND',
        `SurgeryManagement with UUID ${uuid} not found`,
        { uuid },
      );
    }

    // Check surgery status - NO accesso se VALIDATED o CANCELLED
    const currentStatus = surgery.currentStatus as SurgeryManagementStatus;
    
    if (currentStatus === SurgeryManagementStatus.VALIDATED || 
        currentStatus === SurgeryManagementStatus.CANCELLED) {
      throw new SocketException(
        SocketErrorCategory.CONFLICT,
        'SURGERY_CLOSED',
        `SurgeryManagement is ${currentStatus} and cannot be modified`,
        { 
          uuid, 
          currentStatus,
        },
      );
    }

    return surgery;
  }

  // ============================================================================
  // Room Management Handlers
  // ============================================================================

  /**
   * Handle room:join event
   * 
   * Client joins a generic room (no prefix hardcoded)
   * Room format: {resourceType}:{resourceId}
   * 
   * @param data - Join room DTO
   * @param client - Socket.IO client
   */
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      // TASK 10.4: Rate limiting check
      if (!this.checkRateLimit(client.id, 'room:join')) {
        this.handleRateLimitViolation(client, 'room:join');
        return; // Stop execution, rate limit exceeded
      }

      // TASK 8.3: Validate roomId with SocketException
      if (!data.roomId || typeof data.roomId !== 'string') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_ROOM_ID',
          'Room ID is required and must be a non-empty string',
          { providedRoomId: data.roomId },
        );
      }

      const { roomId } = data;
      const user = client.data.user;

      // TASK 8.3: Check authentication with SocketException
      if (!user) {
        throw new SocketException(
          SocketErrorCategory.AUTHORIZATION,
          'UNAUTHENTICATED',
          'User must be authenticated to join a room',
          { roomId },
        );
      }

      // TASK 10.2: Check room capacity before allowing join
      const currentUsers = this.roomUsers.get(roomId)?.size || 0;
      const roomLimits = this.configService.getRoomLimits();
      
      // Extract resource type from roomId (format: "resourceType:resourceId")
      const [resourceType] = roomId.split(':');
      const maxUsers = roomLimits[resourceType] || roomLimits.default;

      if (currentUsers >= maxUsers) {
        // Room is full, reject join
        client.emit('room:join_rejected', {
          roomId,
          reason: 'ROOM_FULL',
          currentUsers,
          maxUsers,
          message: `Room is full. Maximum ${maxUsers} users allowed.`,
        } as RoomJoinRejectedDto);

        this.logger.warn(JSON.stringify({
          event: 'ROOM_JOIN_REJECTED',
          reason: 'ROOM_FULL',
          roomId,
          userId: user.userId,
          currentUsers,
          maxUsers,
        }));

        return; // Stop execution, room is full
      }

      // Join Socket.IO room
      await client.join(roomId);

      // Track user in room
      if (!this.roomUsers.has(roomId)) {
        this.roomUsers.set(roomId, new Map());
      }

      const roomUserDto: RoomUserDto = {
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        socketId: client.id,
        joinedAt: Date.now(),
        lastActivity: Date.now(), // Area 7.2: Track activity
      };

      const roomUserMap = this.roomUsers.get(roomId);
      if (roomUserMap) {
        roomUserMap.set(client.id, roomUserDto);
      }

      // TASK 10.2: Check if room is approaching capacity (90% threshold)
      const newUserCount = currentUsers + 1;
      const percentageUsed = (newUserCount / maxUsers) * 100;

      if (percentageUsed >= 90) {
        // Emit capacity warning to all users in the room
        this.server.to(roomId).emit('room:capacity_warning', {
          roomId,
          currentUsers: newUserCount,
          maxUsers,
          percentageUsed: Math.round(percentageUsed),
          message: `Room is ${Math.round(percentageUsed)}% full (${newUserCount}/${maxUsers} users)`,
        } as RoomCapacityWarningDto);

        this.logger.warn(JSON.stringify({
          event: 'ROOM_CAPACITY_WARNING',
          roomId,
          currentUsers: newUserCount,
          maxUsers,
          percentageUsed: Math.round(percentageUsed),
        }));
      }

      // Log join event with detailed info
      const [logResourceType, logResourceId] = roomId.split(':');
      this.logger.log(JSON.stringify({
        event: '[WebSocket] ROOM_JOINED',
        roomId,
        resourceType: logResourceType || 'unknown',
        resourceId: logResourceId || 'unknown',
        userId: user.userId,
        username: user.username,
        socketId: client.id,
        userCount: newUserCount,
        maxUsers,
        existingUserSocketsInRoom: Array.from(roomUserMap!.values())
          .filter(u => u.userId === user.userId)
          .map(u => u.socketId),
      }));

      // Emit success to client (include capacity info from Task 10.2 + users list from Area 7.1)
      const usersInRoom = Array.from(roomUserMap!.values());
      client.emit('room:joined', {
        roomId,
        userId: user.userId,
        username: user.username,
        success: true,
        joinedAt: roomUserDto.joinedAt,
        currentUsers: newUserCount,
        maxUsers,
        users: usersInRoom, // Area 7.1: Include full user list
      } as RoomJoinedDto);

      // Log metrics overview for frontend debugging
      this.logger.log(JSON.stringify({
        event: 'ROOM_METRICS_OVERVIEW',
        roomId,
        resourceType: logResourceType || 'unknown',
        resourceId: logResourceId || 'unknown',
        triggerUser: user.username,
        metricsSnapshot: {
          totalUsers: usersInRoom.length,
          users: usersInRoom.map(u => ({
            username: u.username,
            userId: u.userId,
            socketId: u.socketId,
            currentSubResource: u.currentSubResource || null, // TAB CORRENTE
            lastActivity: u.lastActivity ? new Date(u.lastActivity).toISOString() : null,
            joinedAt: new Date(u.joinedAt).toISOString(),
            inRoomForSeconds: Math.floor((Date.now() - u.joinedAt) / 1000),
          })),
        },
        frontendParsing: {
          note: 'Frontend should parse users array from room:joined event',
          exampleAccess: 'ack.users.forEach(u => console.log(u.currentSubResource))',
          currentSubResourceValues: usersInRoom
            .filter(u => u.currentSubResource)
            .map(u => `${u.username}: ${u.currentSubResource}`),
        },
      }));

      // Notify other users in the room
      client.to(roomId).emit('user_joined', {
        roomId,
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        socketId: client.id,
        joinedAt: roomUserDto.joinedAt,
      } as UserJoinedRoomDto);

      // Area 7.2: Broadcast presence update to other users (sender already has room:joined with users list)
      const updatedUserList = Array.from(roomUserMap?.values() || []);
      const presenceUpdate: PresenceUpdateDto = {
        roomId,
        users: updatedUserList,
        eventType: 'user_joined',
        triggerUserId: user.userId,
        timestamp: Date.now(),
      };
      client.to(roomId).emit('presence:updated', presenceUpdate);

    } catch (error) {
      // TASK 8.3: Centralized error handling with structured logging
      this.handleSocketError(error, client, 'room:join');
    }
  }

  /**
   * Handle room:leave event
   * 
   * Client leaves a room
   * 
   * @param data - Leave room DTO
   * @param client - Socket.IO client
   */
  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @MessageBody() data: LeaveRoomDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      // TASK 8.3: Validate roomId with SocketException
      if (!data.roomId || typeof data.roomId !== 'string') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_ROOM_ID',
          'Room ID is required and must be a non-empty string',
          { providedRoomId: data.roomId },
        );
      }

      const { roomId } = data;
      const user = client.data.user;

      // TASK 8.3: Check authentication with SocketException
      if (!user) {
        throw new SocketException(
          SocketErrorCategory.AUTHORIZATION,
          'UNAUTHENTICATED',
          'User must be authenticated to leave a room',
          { roomId },
        );
      }

      // Check if user is in room
      const roomUserMap = this.roomUsers.get(roomId);
      const wasInRoom = roomUserMap?.has(client.id) || false;

      // Leave Socket.IO room
      await client.leave(roomId);

      // Remove user from room tracking
      if (roomUserMap) {
        roomUserMap.delete(client.id);

        // Cleanup empty room
        if (roomUserMap.size === 0) {
          this.roomUsers.delete(roomId);
        }
      }

      // Log leave event
      this.logger.log(JSON.stringify({
        event: '[WebSocket] ROOM_LEFT',
        roomId,
        userId: user.userId,
        username: user.username,
        socketId: client.id,
        wasInRoom,
      }));

      // Emit success to client
      client.emit('room:left', {
        roomId,
        userId: user.userId,
        success: true,
        message: wasInRoom ? 'Left room successfully' : 'You were not in room',
      } as RoomLeftDto);

      // Notify other users in the room (if was in room)
      if (wasInRoom) {
        client.to(roomId).emit('user_left', {
          roomId,
          userId: user.userId,
          username: user.username,
          reason: 'manual',
        } as UserLeftRoomDto);

        // Area 7.2: Broadcast presence update to remaining users (leaving user already has room:left)
        const roomUserMap = this.roomUsers.get(roomId);
        const remainingUsers = Array.from(roomUserMap?.values() || []);
        const presenceUpdate: PresenceUpdateDto = {
          roomId,
          users: remainingUsers,
          eventType: 'user_left',
          triggerUserId: user.userId,
          timestamp: Date.now(),
        };
        client.to(roomId).emit('presence:updated', presenceUpdate);
      }

    } catch (error) {
      // TASK 8.3: Centralized error handling with structured logging
      this.handleSocketError(error, client, 'room:leave');
    }
  }

  /**
   * Handle room:query_users event
   * 
   * Client queries list of users in a room
   * 
   * @param data - Query room users DTO
   * @param client - Socket.IO client
   */
  @SubscribeMessage('room:query_users')
  async handleQueryRoomUsers(
    @MessageBody() data: QueryRoomUsersDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      // TASK 8.3: Validate roomId with SocketException
      if (!data.roomId || typeof data.roomId !== 'string') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_ROOM_ID',
          'Room ID is required and must be a non-empty string',
          { providedRoomId: data.roomId },
        );
      }

      const { roomId } = data;
      const roomUserMap = this.roomUsers.get(roomId);

      // Get list of users in room
      const users: RoomUserDto[] = roomUserMap
        ? Array.from(roomUserMap.values())
        : [];

      // TASK 10.2: Calculate room capacity information
      const roomLimits = this.configService.getRoomLimits();
      const [resourceType] = roomId.split(':');
      const maxUsers = roomLimits[resourceType] || roomLimits.default;
      const currentUsers = users.length;
      const percentageUsed = maxUsers > 0 ? Math.round((currentUsers / maxUsers) * 100) : 0;

      // Log query event
      const [logResourceType, logResourceId] = roomId.split(':');
      this.logger.log(JSON.stringify({
        event: '[WebSocket] ROOM_QUERY_USERS',
        roomId,
        userCount: users.length,
        socketId: client.id,
      }));

      // Emit response to client
      client.emit('room:users', {
        roomId,
        users,
        capacity: {
          current: currentUsers,
          max: maxUsers,
          percentageUsed,
        },
      } as RoomUsersDto);

      // Log metrics overview for query response
      this.logger.log(JSON.stringify({
        event: 'ROOM_QUERY_METRICS_OVERVIEW',
        roomId,
        resourceType: logResourceType || 'unknown',
        resourceId: logResourceId || 'unknown',
        requestedBy: client.data?.user?.username || 'unknown',
        metricsSnapshot: {
          totalUsers: users.length,
          capacity: {
            current: currentUsers,
            max: maxUsers,
            percentageUsed,
            remaining: maxUsers - currentUsers,
          },
          users: users.map(u => ({
            username: u.username,
            userId: u.userId,
            currentSubResource: u.currentSubResource || null, // TAB CORRENTE
            lastActivity: u.lastActivity ? new Date(u.lastActivity).toISOString() : null,
            inRoomForSeconds: Math.floor((Date.now() - u.joinedAt) / 1000),
            isIdle: u.lastActivity ? (Date.now() - u.lastActivity) > 300000 : false, // 5 min idle
          })),
        },
        frontendParsing: {
          note: 'Frontend receives room:users event with users array',
          exampleListener: 'socket.emit("room:query_users", {roomId}, (ack) => ack.users.forEach(u => console.log(u.currentSubResource)))',
          tabDistribution: users
            .reduce((acc, u) => {
              const tab = u.currentSubResource || '(none)';
              acc[tab] = (acc[tab] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
        },
      }));

    } catch (error) {
      // TASK 8.3: Centralized error handling with structured logging
      this.handleSocketError(error, client, 'room:query_users');
    }
  }

  // ============================================================================
  // NEW: Generic Resource API (Alias Pattern) - Future-Proof Architecture
  // ============================================================================

  /**
   * Generic Resource Join Handler
   * 
   * NEW generic API for joining any resource type.
   * Routes to specific resource handler based on resourceType.
   * 
   * BACKWARD COMPATIBILITY:
   * - Old API (surgery:join) still works via alias pattern below
   * - New API (resource:join) recommended for all new code
   * 
   * Supported resource types:
   * - surgery-management (implemented - gestione intervento)
   * - outpatient-visit (future - visita ambulatoriale)
   * - surgery-request (future - richiesta intervento)
   * - surgery (future - anagrafica chirurgica)
   * - patient (future - gestione paziente)
   * 
   * @param data - GenericResourceJoinDto with resourceType and resourceUuid
   * @param client - TypedSocket client
   */
  @SubscribeMessage('resource:join')
  async handleGenericResourceJoin(
    @MessageBody() data: GenericResourceJoinDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    // Validate resourceType
    const supportedTypes: ResourceType[] = [
      'surgery-management',
      'surgery-request',
      'surgery',
      'outpatient-visit',
      'patient',
    ];

    if (!supportedTypes.includes(data.resourceType)) {
      throw new SocketException(
        SocketErrorCategory.VALIDATION,
        'UNSUPPORTED_RESOURCE_TYPE',
        `Resource type "${data.resourceType}" is not supported. Supported types: ${supportedTypes.join(', ')}`,
        { providedResourceType: data.resourceType, supportedTypes },
      );
    }

    // Route to specific handler (pass initialSubResourceId for auto-lock)
    return this.routeResourceAction(
      'join', 
      data.resourceType, 
      data.resourceUuid, 
      client, 
      data.initialSubResourceId  // ← NUOVO: Auto-lock support
    );
  }

  /**
   * Generic Resource Leave Handler
   * 
   * NEW generic API for leaving any resource type.
   * 
   * @param data - GenericResourceLeaveDto
   * @param client - TypedSocket client
   */
  @SubscribeMessage('resource:leave')
  async handleGenericResourceLeave(
    @MessageBody() data: GenericResourceLeaveDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    return this.routeResourceAction('leave', data.resourceType, data.resourceUuid, client);
  }

  /**
   * Generic Sub-Resource Lock Handler
   * 
   * NEW generic API for acquiring sub-resource locks.
   * 
   * @param data - GenericSubResourceLockDto
   * @param client - TypedSocket client
   */
  @SubscribeMessage('resource:subresource_lock')
  async handleGenericSubResourceLock(
    @MessageBody() data: GenericSubResourceLockDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    return this.routeResourceAction(
      'lock',
      data.resourceType,
      data.resourceUuid,
      client,
      data.subResourceId,
    );
  }

  /**
   * Generic Sub-Resource Unlock Handler
   * 
   * NEW generic API for releasing sub-resource locks.
   * 
   * @param data - GenericSubResourceUnlockDto
   * @param client - TypedSocket client
   */
  @SubscribeMessage('resource:subresource_unlock')
  async handleGenericSubResourceUnlock(
    @MessageBody() data: GenericSubResourceUnlockDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    return this.routeResourceAction(
      'unlock',
      data.resourceType,
      data.resourceUuid,
      client,
      data.subResourceId,
    );
  }

  /**
   * Resource Action Router
   * 
   * Routes generic resource:* events to specific resource handlers.
   * 
   * ARCHITECTURE:
   * - Centralized routing logic
   * - Easy to add new resource types
   * - Clear error messages for unsupported combinations
   * 
   * @param action - Action type (join, leave, lock, unlock)
   * @param resourceType - Resource type (surgery-management, etc.)
   * @param resourceUuid - Resource UUID
   * @param client - TypedSocket client
   * @param subResourceId - Optional sub-resource ID (for lock/unlock)
   */
  private async routeResourceAction(
    action: 'join' | 'leave' | 'lock' | 'unlock',
    resourceType: ResourceType,
    resourceUuid: string,
    client: TypedSocket,
    subResourceId?: string,
  ): Promise<void> {
    // Currently only surgery-management is implemented
    if (resourceType === 'surgery-management') {
      switch (action) {
        case 'join':
          // Pass initialSubResourceId for auto-lock support
          return this.handleSurgeryJoin(
            { 
              uuid: resourceUuid, 
              initialSubResourceId: subResourceId as any  // Type checked at runtime
            }, 
            client
          );
        case 'leave':
          return this.handleSurgeryLeave({ uuid: resourceUuid }, client);
        case 'lock':
          if (!subResourceId) {
            throw new SocketException(
              SocketErrorCategory.VALIDATION,
              'MISSING_SUBRESOURCE_ID',
              'subResourceId is required for lock action',
            );
          }
          return this.handleSubResourceLockAcquire(
            { resourceUuid, subResourceId },
            client,
          );
        case 'unlock':
          if (!subResourceId) {
            throw new SocketException(
              SocketErrorCategory.VALIDATION,
              'MISSING_SUBRESOURCE_ID',
              'subResourceId is required for unlock action',
            );
          }
          return this.handleSubResourceLockRelease(
            { resourceUuid, subResourceId },
            client,
          );
      }
    }

    // Future: Add handlers for other resource types
    // if (resourceType === 'outpatient-visit') { ... }
    // if (resourceType === 'patient') { ... }

    throw new SocketException(
      SocketErrorCategory.VALIDATION,
      'RESOURCE_TYPE_NOT_IMPLEMENTED',
      `Resource type "${resourceType}" is not yet implemented for action "${action}"`,
      { resourceType, action, supportedTypes: ['surgery-management'] },
    );
  }

  // ============================================================================
  // AREA 7.1 - Surgery Join/Leave Handlers (Backward-Compatible Aliases)
  // ============================================================================

  /**
   * Handle surgery:join event with business validation
   * 
   * BACKWARD COMPATIBILITY ALIAS
   * @deprecated Use resource:join with resourceType='surgery-management' instead
   * 
   * Business Rules:
   * - Verify SurgeryManagement exists
   * - Verify status != VALIDATED && != CANCELLED
   * - Apply room capacity limits (Task 10.2)
   * - Apply rate limiting (Task 10.4)
   * 
   * @param data - ResourceJoinDto with surgery uuid
   * @param client - TypedSocket client
   */
  @SubscribeMessage('surgery:join')
  async handleSurgeryJoin(
    @MessageBody() data: ResourceJoinDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(client.id, 'surgery:join')) {
        throw new SocketException(
          SocketErrorCategory.RATE_LIMIT,
          'RATE_LIMIT_EXCEEDED',
          'Too many surgery join requests. Please slow down.',
          { socketId: client.id },
        );
      }

      // Validate uuid format
      if (!data.uuid || typeof data.uuid !== 'string' || data.uuid.trim() === '') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_UUID',
          'Surgery UUID is required and must be a valid non-empty string',
          { providedUuid: data.uuid },
        );
      }

      // Validate UUID format (RFC 4122)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(data.uuid)) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_UUID_FORMAT',
          'Surgery UUID must be a valid UUID format (e.g., 550e8400-e29b-41d4-a716-446655440000)',
          { providedUuid: data.uuid },
        );
      }

      const { uuid, initialSubResourceId } = data;

      // Business validation: Verify surgery exists and status is valid
      const surgery = await this.validateSurgeryManagementAccess(uuid);

      // Build roomId from uuid (standard format: resourceType:resourceId)
      const roomId = `surgery-management:${uuid}`;

      // If initialSubResourceId provided AND auto-lock enabled, perform auto-lock join
      if (initialSubResourceId && this.configService.isAutoLockEnabled()) {
        return this.handleSurgeryJoinWithAutoLock(
          uuid,
          roomId,
          initialSubResourceId,
          client,
        );
      }

      // If initialSubResourceId provided but auto-lock DISABLED, log warning
      if (initialSubResourceId && !this.configService.isAutoLockEnabled()) {
        this.logger.warn(JSON.stringify({
          event: 'AUTO_LOCK_DISABLED',
          uuid,
          userId: client.data.user?.userId,
          initialSubResourceId,
          message: 'Client requested auto-lock but feature is disabled in config',
        }));
      }

      // Standard join without auto-lock (backward compatibility)
      // Reuse generic room join logic (includes capacity checks from Task 10.2)
      await this.handleJoinRoom(
        { roomId },
        client,
      );

      // Note: handleJoinRoom already emits room:joined and broadcasts user_joined
      // No need to emit again here

    } catch (error) {
      // Resource-specific error handling (Surgery business logic)
      if (error instanceof SocketException) {
        // Map business errors to ResourceJoinRejectedDto
        const rejection: ResourceJoinRejectedDto = {
          uuid: data.uuid,
          reason: error.errorCode,
          message: error.message,
          resourceType: 'surgery-management',
        };

        // Add resource status if it's a SURGERY_CLOSED error
        if (error.errorCode === 'SURGERY_CLOSED' && error.details?.currentStatus) {
          rejection.resourceStatus = error.details.currentStatus;
        }

        // Add capacity info if it's a ROOM_FULL error
        if (error.errorCode === 'ROOM_FULL' && error.details) {
          rejection.currentUsers = error.details.currentUsers;
          rejection.maxUsers = error.details.maxUsers;
        }

        client.emit('surgery:join_rejected', rejection);

        // Log rejection
        this.logger.warn(JSON.stringify({
          event: 'SURGERY_JOIN_REJECTED',
          uuid: data.uuid,
          reason: error.errorCode,
          socketId: client.id,
          userId: client.data.user?.userId,
        }));
      } else {
        // Handle unexpected errors with centralized error handler
        this.handleSocketError(error, client, 'surgery:join');
      }
    }
  }

  /**
   * Handle Surgery Join with Auto-Lock
   * 
   * NUOVO: Variante di handleSurgeryJoin che acquisisce automaticamente un lock
   * sulla sub-resource specificata durante il join.
   * 
   * Flusso:
   * 1. Join room normalmente
   * 2. Set currentSubResource = initialSubResourceId
   * 3. Attempt to acquire lock on sub-resource
   * 4. Return combined result in ACK
   * 
   * @param uuid - Surgery UUID
   * @param roomId - Computed room ID
   * @param initialSubResourceId - Sub-resource to auto-lock
   * @param client - Socket client
   * @since v1.2.0
   */
  private async handleSurgeryJoinWithAutoLock(
    uuid: string,
    roomId: string,
    initialSubResourceId: string,
    client: TypedSocket,
  ): Promise<void> {
    const user = client.data.user;

    // Get room limits for capacity check
    const roomLimits = this.configService.getRoomLimits();
    const maxUsers = roomLimits['surgery-management'] || roomLimits.default;

    // Check room capacity
    const currentUsers = this.roomUsers.get(roomId)?.size || 0;
    if (currentUsers >= maxUsers) {
      throw new SocketException(
        SocketErrorCategory.CONFLICT,
        'ROOM_FULL',
        `Room ${roomId} is full (${currentUsers}/${maxUsers} users)`,
        { roomId, currentUsers, maxUsers },
      );
    }

    // Join Socket.IO room
    await client.join(roomId);

    // Add user to room tracking with initialSubResourceId set
    if (!this.roomUsers.has(roomId)) {
      this.roomUsers.set(roomId, new Map());
    }

    const roomUserMap = this.roomUsers.get(roomId)!;
    const roomUserDto: RoomUserDto = {
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      socketId: client.id,
      joinedAt: Date.now(),
      currentSubResource: initialSubResourceId as any,  // Set immediately
      lastActivity: Date.now(),
    };

    roomUserMap.set(client.id, roomUserDto);

    // Get all users in room
    const usersInRoom = Array.from(roomUserMap.values());

    // ============================================================================
    // AUTO-LOCK LOGIC
    // ============================================================================
    let autoLockResult: RoomJoinedDto['autoLock'];

    this.logger.log(JSON.stringify({
      event: 'AUTO_LOCK_ATTEMPT',
      roomId,
      userId: user.userId,
      username: user.username,
      subResourceId: initialSubResourceId,
    }));

    try {
      const lockKey = this.getSubResourceLockKey('surgery-management', uuid, initialSubResourceId);
      const existingLock = this.subResourceLocks.get(lockKey);

      if (existingLock) {
        // Lock already held by someone else
        this.logger.warn(JSON.stringify({
          event: 'AUTO_LOCK_DENIED',
          roomId,
          userId: user.userId,
          subResourceId: initialSubResourceId,
          lockedBy: existingLock.username,
          reason: 'ALREADY_LOCKED',
        }));

        autoLockResult = {
          acquired: false,
          subResourceId: initialSubResourceId,
          denialReason: 'ALREADY_LOCKED',
          lockedBy: {
            userId: existingLock.userId,
            username: existingLock.username,
            socketId: existingLock.socketId,
          },
        };
      } else {
        // Acquire lock
        const now = Date.now();
        const expiresAt = now + this.LOCK_TTL_MS;

        const newLock: SubResourceLock = {
          resourceType: 'surgery-management',
          resourceUuid: uuid,
          subResourceId: initialSubResourceId,
          userId: user.userId,
          username: user.username,
          socketId: client.id,
          lockedAt: now,
          expiresAt,
        };

        this.subResourceLocks.set(lockKey, newLock);

        // Schedule lock timers (warning + expiry)
        this.scheduleLockTimers(
          'surgery-management',
          uuid,
          initialSubResourceId,
          user.userId,
          user.username,
          client.id,
        );

        this.logger.log(JSON.stringify({
          event: 'AUTO_LOCK_ACQUIRED',
          roomId,
          userId: user.userId,
          username: user.username,
          subResourceId: initialSubResourceId,
          lockedAt: new Date(now).toISOString(),
          expiresAt: new Date(expiresAt).toISOString(),
        }));

        autoLockResult = {
          acquired: true,
          subResourceId: initialSubResourceId,
          lockedAt: new Date(now).toISOString(),
        };

        // Broadcast subresource:locked to OTHER users in room (not to self)
        client.to(roomId).emit('subresource:locked', {
          resourceType: 'surgery-management',
          resourceUuid: uuid,
          subResourceId: initialSubResourceId,
          userId: user.userId,
          username: user.username,
          lockedAt: now,
          expiresAt,
        } as SubResourceLockedDto);
      }
    } catch (lockError) {
      // Log error but don't fail join
      this.logger.error(JSON.stringify({
        event: 'AUTO_LOCK_ERROR',
        roomId,
        userId: user.userId,
        subResourceId: initialSubResourceId,
        error: lockError.message,
      }));

      autoLockResult = {
        acquired: false,
        subResourceId: initialSubResourceId,
        denialReason: 'INTERNAL_ERROR',
      };
    }

    // ============================================================================
    // RESPONSE
    // ============================================================================

    const response: RoomJoinedDto = {
      roomId,
      userId: user.userId,
      username: user.username,
      success: true,
      joinedAt: Date.now(),
      currentUsers: usersInRoom.length,
      maxUsers,
      users: usersInRoom,
      autoLock: autoLockResult,  // ← NUOVO campo
    };

    // Emit to client (includes autoLock result)
    client.emit('resource:joined', response);

    // Broadcast to others (user_joined - no autoLock, that's personal)
    client.to(roomId).emit('user:joined', {
      roomId,
      userId: user.userId,
      username: user.username,
      joinedAt: Date.now(),
    } as UserJoinedRoomDto);

    // Broadcast presence update (include currentSubResource)
    client.to(roomId).emit('presence:updated', {
      roomId,
      users: usersInRoom,
      eventType: 'user_joined',
      triggerUserId: user.userId,
      timestamp: Date.now(),
    } as PresenceUpdateDto);

    // Log complete join with auto-lock result
    this.logger.log(JSON.stringify({
      event: '[WebSocket] SURGERY_JOINED_WITH_AUTOLOCK',
      roomId,
      uuid,
      userId: user.userId,
      username: user.username,
      socketId: client.id,
      userCount: usersInRoom.length,
      initialSubResourceId,
      autoLockAcquired: autoLockResult.acquired,
    }));
  }

  /**
   * Handle surgery:leave event
   * 
   * Note: No business validation needed for leave operations.
   * Users can always leave a surgery room regardless of status.
   * 
   * @param data - ResourceLeaveDto with surgery uuid
   * @param client - TypedSocket client
   */
  @SubscribeMessage('surgery:leave')
  async handleSurgeryLeave(
    @MessageBody() data: ResourceLeaveDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      // Validate uuid format
      if (!data.uuid || typeof data.uuid !== 'string' || data.uuid.trim() === '') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_UUID',
          'Surgery UUID is required and must be a valid non-empty string',
          { providedUuid: data.uuid },
        );
      }

      const { uuid } = data;
      const roomId = `surgery-management:${uuid}`;

      // Reuse generic room leave logic
      await this.handleLeaveRoom({ roomId }, client);

      // Note: handleLeaveRoom already emits room:left and broadcasts user_left

    } catch (error) {
      // Handle errors with centralized error handler
      this.handleSocketError(error, client, 'surgery:leave');
    }
  }

  // ============================================================================
  // AREA 7.2 - Presence Management Handlers
  // ============================================================================

  /**
   * Handle set current sub-resource event (Area 7.2 - Presence Management)
   * 
   * Client -> Server: presence:set_current_subresource
   * Server -> Room: presence:updated (broadcast to all including sender)
   * 
   * Allows client to communicate which sub-resource/child entity they are currently viewing.
   * Updates presence state and broadcasts to all room members for real-time collaboration.
   * 
   * Business Rules:
   * - User must be in room
   * - subResourceId is optional (can be null/empty to clear)
   * - Updates lastActivity timestamp
   * 
   * Generic Architecture: Works with any resource type (Surgery, Patient, Visit, etc.)
   * 
   * @param data - SetCurrentSubResourceDto with roomId and subResourceId
   * @param client - Connected socket
   */
  @SubscribeMessage('presence:set_current_subresource')
  async handleSetCurrentSubResource(
    @MessageBody() data: SetCurrentSubResourceDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { roomId, subResourceType } = data;
      const userId = client.data?.user?.userId;
      const username = client.data?.user?.username;

      // Validate roomId
      if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_ROOM_ID',
          'Room ID is required and must be a valid non-empty string',
          { providedRoomId: roomId },
        );
      }

      // Check if user is in room
      const roomUserMap = this.roomUsers.get(roomId);
      if (!roomUserMap || !roomUserMap.has(client.id)) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'USER_NOT_IN_ROOM',
          `User is not in room ${roomId}`,
          { roomId, userId },
        );
      }

      // Update user's currentSubResource and lastActivity
      const userDto = roomUserMap.get(client.id);
      if (userDto) {
        userDto.currentSubResource = subResourceType || undefined;
        userDto.lastActivity = Date.now();
      }

      // Broadcast presence update to all users in room (including sender)
      const users = Array.from(roomUserMap.values());
      const presenceUpdate: PresenceUpdateDto = {
        roomId,
        users,
        eventType: 'subresource_changed' as PresenceEventType,
        triggerUserId: userId,
        timestamp: Date.now(),
      };

      this.server.in(roomId).emit('presence:updated', presenceUpdate);

      const [logResourceType, logResourceId] = roomId.split(':');
      this.logger.log(JSON.stringify({
        event: 'PRESENCE_SUBRESOURCE_CHANGED',
        roomId,
        userId,
        username,
        subResourceType: subResourceType || '(cleared)',
        timestamp: new Date().toISOString(),
      }));

      // Log metrics overview after presence update
      this.logger.log(JSON.stringify({
        event: 'PRESENCE_METRICS_OVERVIEW',
        roomId,
        resourceType: logResourceType || 'unknown',
        resourceId: logResourceId || 'unknown',
        triggerUser: username,
        triggerAction: 'subresource_changed',
        metricsSnapshot: {
          totalUsers: users.length,
          users: users.map(u => ({
            username: u.username,
            userId: u.userId,
            currentSubResource: u.currentSubResource || null, // TAB CORRENTE
            lastActivity: u.lastActivity ? new Date(u.lastActivity).toISOString() : null,
            secondsSinceLastActivity: u.lastActivity ? Math.floor((Date.now() - u.lastActivity) / 1000) : null,
          })),
        },
        frontendParsing: {
          note: 'Frontend receives presence:updated event with users array',
          exampleListener: 'socket.on("presence:updated", data => data.users.forEach(u => console.log(u.currentSubResource)))',
          currentSubResourceDistribution: users
            .reduce((acc, u) => {
              const tab = u.currentSubResource || '(none)';
              acc[tab] = (acc[tab] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
        },
      }));

    } catch (error) {
      this.handleSocketError(error, client, 'presence:set_current_subresource');
    }
  }

  // ============================================================================
  // AREA 9 - Activity Tracking & Lock TTL Management
  // ============================================================================

  /**
   * Handle user heartbeat event (Area 9 - Activity Tracking)
   * 
   * Client -> Server: user:heartbeat
   * No response to client (fire-and-forget)
   * 
   * Receives periodic heartbeat from client to update lastActivity timestamp.
   * Used by sweep job to determine if user is still active and prevent lock TTL expiry.
   * 
   * Business Rules:
   * - Updates lastActivity for user in ALL rooms they are currently in
   * - No validation errors thrown (resilient to malformed data)
   * - Logs heartbeat for monitoring purposes
   * 
   * Backend-Driven Strategy:
   * - Client emits heartbeat passively (no knowledge of TTL logic)
   * - Backend sweep job enforces TTL and emits warning/expiry events
   * - Survives reconnections (lastActivity persists in roomUsers Map)
   * 
   * @param data - HeartbeatDto with lastActivity timestamp from Date.now()
   * @param client - Connected socket
   */
  @SubscribeMessage('user:heartbeat')
  async handleHeartbeat(
    @MessageBody() data: HeartbeatDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const userId = client.data?.user?.userId;
      const lastActivity = data?.lastActivity || Date.now();

      // Update lastActivity for user in all rooms they are currently in
      let updatedRoomsCount = 0;
      for (const [roomId, usersMap] of this.roomUsers.entries()) {
        const user = usersMap.get(client.id);
        if (user) {
          user.lastActivity = lastActivity;
          updatedRoomsCount++;
        }
      }

      this.logger.debug(
        JSON.stringify({
          event: 'HEARTBEAT_RECEIVED',
          userId,
          lastActivity,
          updatedRoomsCount,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      // Resilient: don't throw errors for heartbeat (log only)
      this.logger.error(
        JSON.stringify({
          event: 'HEARTBEAT_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: client.data?.user?.userId,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  // ============================================================================
  // AREA 7.4 - Lock Extension Handler
  // ============================================================================

  /**
   * Handle lock extension request (Area 7.4)
   * 
   * Client → Server: lock:extend
   * Server → Client: lock:extended (success) OR error (failure)
   * 
   * Client requests to extend lock TTL in response to lock:expiring_soon warning.
   * Resets timer to full 3h from now.
   * 
   * Business Rules:
   * - Lock must exist and be owned by requesting user
   * - Reschedules both warning and expiry timers
   * - Returns new expiry timestamp to client
   * 
   * @param data - LockExtendDto with resourceType, resourceUuid, subResourceId
   * @param client - Connected socket
   */
  @SubscribeMessage('lock:extend')
  async handleLockExtend(
    @MessageBody() data: LockExtendDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { resourceType, resourceUuid, subResourceId } = data;
      const userId = client.data?.user?.userId;

      // Validate inputs
      if (!resourceType || !resourceUuid || !subResourceId) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_LOCK_EXTEND_DATA',
          'resourceType, resourceUuid, and subResourceId are required',
          { providedData: data },
        );
      }

      // Attempt to extend lock
      const newExpiresAt = this.extendLock(
        resourceType,
        resourceUuid,
        subResourceId,
        userId!,
      );

      if (!newExpiresAt) {
        // Lock not found or not owned by user
        throw new SocketException(
          SocketErrorCategory.NOT_FOUND,
          'LOCK_NOT_FOUND',
          'Lock not found or already released. Cannot extend.',
          { resourceType, resourceUuid, subResourceId, userId },
        );
      }

      // Success: Emit confirmation to client
      const extendedDto: LockExtendedDto = {
        resourceType: resourceType as any,
        resourceUuid,
        subResourceId,
        newExpiresAt,
      };

      client.emit('lock:extended', extendedDto);

      this.logger.log(JSON.stringify({
        event: 'LOCK_EXTENDED',
        resourceType,
        resourceUuid,
        subResourceId,
        userId,
        newExpiresAt,
      }));

    } catch (error) {
      this.handleSocketError(error, client, 'lock:extend');
    }
  }

  // ============================================================================
  // AREA 7.5 - Lock Force Request Handlers
  // ============================================================================

  /**
   * Handle Force Lock Request
   * 
   * Client → Server: resource:subresource_lock:force_request
   * Server → Owner: resource:subresource_lock:force_request_received
   * Server → Requester: resource:subresource_lock:force_request_pending
   * 
   * Allows a user to request forceful release of a lock held by another user.
   * Owner has 30 seconds to approve/reject, otherwise auto-rejects.
   * 
   * Business Rules:
   * - Lock must exist and be owned by another user
   * - Cannot force own lock
   * - Only one pending request per sub-resource at a time
   * - Auto-reject after 30s timeout
   * - Auto-reject if owner disconnects
   * 
   * Area 7.5: Lock Force Request
   * 
   * @param data - ForceRequestDto with resourceType, resourceUuid, subResourceId, message
   * @param client - Connected socket (requester)
   */
  @SubscribeMessage('resource:subresource_lock:force_request')
  async handleForceRequest(
    @MessageBody() data: ForceRequestDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { resourceType, resourceUuid, subResourceId, message } = data;
      const requesterId = client.data?.user?.userId;
      const requesterUsername = client.data?.user?.username;

      // Validate inputs
      if (!resourceType || !resourceUuid || !subResourceId) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_FORCE_REQUEST_DATA',
          'resourceType, resourceUuid, and subResourceId are required',
          { providedData: data },
        );
      }

      // Check if lock exists
      const lockKey = this.getSubResourceLockKey(resourceType, resourceUuid, subResourceId);
      const lock = this.subResourceLocks.get(lockKey);

      if (!lock) {
        throw new SocketException(
          SocketErrorCategory.NOT_FOUND,
          'LOCK_NOT_FOUND',
          'Lock does not exist. Cannot request force release.',
          { resourceType, resourceUuid, subResourceId },
        );
      }

      // Check if requester is trying to force their own lock
      if (lock.userId === requesterId) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'CANNOT_FORCE_OWN_LOCK',
          'You already own this lock. Use normal release instead.',
          { resourceType, resourceUuid, subResourceId },
        );
      }

      // Check if there's already a pending request for this lock
      const existingRequest = Array.from(this.forceRequests.values()).find(
        (req) =>
          req.resourceType === resourceType &&
          req.resourceUuid === resourceUuid &&
          req.subResourceId === subResourceId &&
          req.status === 'pending',
      );

      if (existingRequest) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'FORCE_REQUEST_ALREADY_PENDING',
          'A force request is already pending for this lock',
          {
            resourceType,
            resourceUuid,
            subResourceId,
            existingRequestId: existingRequest.requestId,
          },
        );
      }

      // Generate unique request ID
      const requestId = this.generateUuid();
      const now = Date.now();
      const expiresAt = now + this.FORCE_REQUEST_TIMEOUT_MS;

      // Create timeout timer
      const timeoutTimer = setTimeout(() => {
        this.handleForceRequestTimeout(requestId);
      }, this.FORCE_REQUEST_TIMEOUT_MS);

      // Store force request
      const forceRequest: ForceRequest = {
        requestId,
        resourceType,
        resourceUuid,
        subResourceId,
        requesterId: requesterId!,
        requesterUsername: requesterUsername!,
        requesterSocketId: client.id,
        ownerId: lock.userId,
        ownerUsername: lock.username,
        ownerSocketId: lock.socketId,
        message,
        createdAt: now,
        expiresAt,
        timeoutTimer,
        status: 'pending',
      };

      this.forceRequests.set(requestId, forceRequest);

      // Emit to owner: force_request_received
      const receivedDto: ForceRequestReceivedDto = {
        resourceType: resourceType as any,
        resourceUuid,
        subResourceId,
        requestId,
        requestedBy: {
          userId: requesterId!,
          username: requesterUsername!,
        },
        message,
        timeoutSeconds: 30,
        expiresAt,
      };

      this.server.to(lock.socketId).emit('resource:subresource_lock:force_request_received', receivedDto);

      // Emit to requester: force_request_pending
      const pendingDto: ForceRequestPendingDto = {
        resourceType: resourceType as any,
        resourceUuid,
        subResourceId,
        requestId,
        lockedBy: {
          userId: lock.userId,
          username: lock.username,
        },
        timeoutSeconds: 30,
        expiresAt,
      };

      client.emit('resource:subresource_lock:force_request_pending', pendingDto);

      this.logger.log(JSON.stringify({
        event: 'FORCE_REQUEST_CREATED',
        requestId,
        resourceType,
        resourceUuid,
        subResourceId,
        requesterId,
        ownerId: lock.userId,
        expiresAt,
      }));

    } catch (error) {
      this.handleSocketError(error, client, 'resource:subresource_lock:force_request');
    }
  }

  /**
   * Handle Force Lock Response (Owner's approval/rejection)
   * 
   * Client → Server: resource:subresource_lock:force_response
   * Server → Requester: resource:subresource_lock:force_request_approved OR force_request_rejected
   * Server → Room: resource:subresource_unlocked (if approved)
   * Server → Requester: resource:subresource_locked (if approved)
   * 
   * Owner responds to force request within 30s timeout.
   * If approved: forcefully releases owner's lock, grants lock to requester.
   * If rejected: maintains owner's lock, notifies requester.
   * 
   * Area 7.5: Lock Force Request
   * 
   * @param data - ForceResponseDto with requestId, approved, message
   * @param client - Connected socket (owner)
   */
  @SubscribeMessage('resource:subresource_lock:force_response')
  async handleForceResponse(
    @MessageBody() data: ForceResponseDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { resourceType, resourceUuid, subResourceId, requestId, approved, message: responseMessage } = data;
      const ownerId = client.data?.user?.userId;

      // Validate inputs
      if (!requestId || approved === undefined) {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'INVALID_FORCE_RESPONSE_DATA',
          'requestId and approved are required',
          { providedData: data },
        );
      }

      // Find force request
      const forceRequest = this.forceRequests.get(requestId);

      if (!forceRequest) {
        throw new SocketException(
          SocketErrorCategory.NOT_FOUND,
          'FORCE_REQUEST_NOT_FOUND',
          'Force request not found or already processed',
          { requestId },
        );
      }

      // Validate ownership
      if (forceRequest.ownerId !== ownerId) {
        throw new SocketException(
          SocketErrorCategory.AUTHORIZATION,
          'NOT_LOCK_OWNER',
          'Only the lock owner can respond to force requests',
          { requestId, ownerId, expectedOwnerId: forceRequest.ownerId },
        );
      }

      // Check if request is still pending
      if (forceRequest.status !== 'pending') {
        throw new SocketException(
          SocketErrorCategory.VALIDATION,
          'FORCE_REQUEST_ALREADY_PROCESSED',
          `Force request already ${forceRequest.status}`,
          { requestId, currentStatus: forceRequest.status },
        );
      }

      // Clear timeout timer
      clearTimeout(forceRequest.timeoutTimer);

      if (approved) {
        // APPROVED: Force release lock and grant to requester
        forceRequest.status = 'approved';

        const lockKey = this.getSubResourceLockKey(
          forceRequest.resourceType,
          forceRequest.resourceUuid,
          forceRequest.subResourceId,
        );

        // Force release current lock
        const roomId = `${forceRequest.resourceType}:${forceRequest.resourceUuid}`;
        this.forceReleaseLock(
          lockKey,
          forceRequest.ownerId,
          forceRequest.ownerUsername,
          forceRequest.resourceType,
          forceRequest.resourceUuid,
          forceRequest.subResourceId,
          roomId,
          'timeout', // Use 'timeout' as reason for forced release
        );

        // Grant lock to requester
        const now = Date.now();
        const expiresAt = now + this.LOCK_TTL_MS;

        this.subResourceLocks.set(lockKey, {
          resourceType: forceRequest.resourceType,
          resourceUuid: forceRequest.resourceUuid,
          subResourceId: forceRequest.subResourceId,
          userId: forceRequest.requesterId,
          username: forceRequest.requesterUsername,
          socketId: forceRequest.requesterSocketId,
          lockedAt: now,
          expiresAt,
        });

        // Schedule timers for new lock
        this.scheduleLockTimers(
          forceRequest.resourceType,
          forceRequest.resourceUuid,
          forceRequest.subResourceId,
          forceRequest.requesterId,
          forceRequest.requesterUsername,
          forceRequest.requesterSocketId,
        );

        // Emit to requester: force_request_approved
        const approvedDto: ForceRequestApprovedDto = {
          resourceType: forceRequest.resourceType as any,
          resourceUuid: forceRequest.resourceUuid,
          subResourceId: forceRequest.subResourceId,
          requestId,
          approvedBy: {
            userId: forceRequest.ownerId,
            username: forceRequest.ownerUsername,
          },
          message: responseMessage,
        };

        this.server.to(forceRequest.requesterSocketId).emit('resource:subresource_lock:force_request_approved', approvedDto);

        // Emit to requester: subresource_locked
        const lockedDto: SubResourceLockedDto = {
          resourceType: forceRequest.resourceType as any,
          resourceUuid: forceRequest.resourceUuid,
          subResourceId: forceRequest.subResourceId,
          userId: forceRequest.requesterId,
          username: forceRequest.requesterUsername,
          lockedAt: now,
          expiresAt,
        };

        this.server.to(forceRequest.requesterSocketId).emit('resource:subresource_locked', lockedDto);

        this.logger.log(JSON.stringify({
          event: 'FORCE_REQUEST_APPROVED',
          requestId,
          ownerId: forceRequest.ownerId,
          requesterId: forceRequest.requesterId,
          lockKey,
        }));

      } else {
        // REJECTED: Maintain owner's lock
        forceRequest.status = 'rejected';

        // Emit to requester: force_request_rejected
        const rejectedDto: ForceRequestRejectedDto = {
          resourceType: forceRequest.resourceType as any,
          resourceUuid: forceRequest.resourceUuid,
          subResourceId: forceRequest.subResourceId,
          requestId,
          reason: 'OWNER_REJECTED',
          message: responseMessage,
        };

        this.server.to(forceRequest.requesterSocketId).emit('resource:subresource_lock:force_request_rejected', rejectedDto);

        this.logger.log(JSON.stringify({
          event: 'FORCE_REQUEST_REJECTED',
          requestId,
          ownerId: forceRequest.ownerId,
          requesterId: forceRequest.requesterId,
          reason: 'OWNER_REJECTED',
        }));
      }

      // Cleanup force request
      this.forceRequests.delete(requestId);

    } catch (error) {
      this.handleSocketError(error, client, 'resource:subresource_lock:force_response');
    }
  }

  /**
   * Handle Force Request Timeout
   * 
   * Called when owner doesn't respond within 30 seconds.
   * Auto-rejects the force request.
   * 
   * Area 7.5: Lock Force Request
   * 
   * @param requestId - Force request ID
   */
  private handleForceRequestTimeout(requestId: string): void {
    const forceRequest = this.forceRequests.get(requestId);

    if (!forceRequest || forceRequest.status !== 'pending') {
      return; // Already processed
    }

    forceRequest.status = 'timeout';

    // Emit to requester: force_request_rejected (timeout)
    const rejectedDto: ForceRequestRejectedDto = {
      resourceType: forceRequest.resourceType as any,
      resourceUuid: forceRequest.resourceUuid,
      subResourceId: forceRequest.subResourceId,
      requestId,
      reason: 'TIMEOUT',
    };

    this.server.to(forceRequest.requesterSocketId).emit('resource:subresource_lock:force_request_rejected', rejectedDto);

    this.logger.warn(JSON.stringify({
      event: 'FORCE_REQUEST_TIMEOUT',
      requestId,
      ownerId: forceRequest.ownerId,
      requesterId: forceRequest.requesterId,
    }));

    // Cleanup
    this.forceRequests.delete(requestId);
  }

  /**
   * Generate UUID v4
   * 
   * Simple UUID generator for request IDs.
   * 
   * @returns UUID string
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============================================================================
  // AREA 7.3 - Sub-Resource Lock Handlers
  // ============================================================================

  /**
   * Handle sub-resource lock acquisition
   * 
   * Client → Server: surgery:subresource_lock_acquire
   * Server → Client: subresource:lock_acquired (success) OR subresource:lock_denied (failure)
   * Server → Room: subresource:locked (broadcast to others)
   * 
   * Business Rules:
   * - User must be in room (joined resource)
   * - Sub-resource must not be locked by another user
   * - SubResourceId must be valid (non-empty)
   * 
   * @param data - SubResourceLockDto with resourceUuid and subResourceId
   * @param client - Connected socket
   */
  @SubscribeMessage('surgery:subresource_lock_acquire')
  async handleSubResourceLockAcquire(
    @MessageBody() data: SubResourceLockDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { resourceUuid, subResourceId } = data;
      const userId = client.data?.user?.userId;
      const username = client.data?.user?.username;
      const resourceType = 'surgery-management';
      const roomId = `${resourceType}:${resourceUuid}`;

      // Validate subResourceId
      if (!subResourceId || typeof subResourceId !== 'string' || subResourceId.trim() === '') {
        const deniedDto: SubResourceLockDeniedDto = {
          resourceType,
          resourceUuid,
          subResourceId: subResourceId || '',
          reason: 'INVALID_SUBRESOURCE_ID',
          message: 'Invalid or empty subResourceId',
        };
        client.emit('subresource:lock_denied', deniedDto);
        return;
      }

      // Check if user is in room
      const roomUserMap = this.roomUsers.get(roomId);
      if (!roomUserMap || !roomUserMap.has(client.id)) {
        const deniedDto: SubResourceLockDeniedDto = {
          resourceType,
          resourceUuid,
          subResourceId,
          reason: 'USER_NOT_IN_ROOM',
          message: `User is not in room ${roomId}`,
        };
        client.emit('subresource:lock_denied', deniedDto);
        return;
      }

      // Check if sub-resource is already locked
      if (this.isSubResourceLocked(resourceType, resourceUuid, subResourceId)) {
        const existingLock = this.getSubResourceLock(resourceType, resourceUuid, subResourceId);
        
        const deniedDto: SubResourceLockDeniedDto = {
          resourceType,
          resourceUuid,
          subResourceId,
          reason: 'SUBRESOURCE_ALREADY_LOCKED',
          message: `Sub-resource '${subResourceId}' is already locked by another user`,
          currentLockHolder: existingLock ? {
            userId: existingLock.userId,
            username: existingLock.username,
            lockedAt: existingLock.lockedAt,
            expiresAt: existingLock.expiresAt,
          } : undefined,
        };
        client.emit('subresource:lock_denied', deniedDto);
        return;
      }

      // Acquire lock
      const acquired = this.acquireSubResourceLock(
        resourceType,
        resourceUuid,
        subResourceId,
        userId!,
        username!,
        client.id,
      );

      if (!acquired) {
        // Should not happen (race condition?)
        const deniedDto: SubResourceLockDeniedDto = {
          resourceType,
          resourceUuid,
          subResourceId,
          reason: 'SUBRESOURCE_ALREADY_LOCKED',
          message: 'Failed to acquire lock (race condition)',
        };
        client.emit('subresource:lock_denied', deniedDto);
        return;
      }

      // Emit success to requester
      const acquiredDto: SubResourceLockAcquiredDto = {
        resourceType,
        resourceUuid,
        subResourceId,
        userId: userId!,
        username: username!,
        success: true,
        lockedAt: Date.now(),
        expiresAt: undefined, // No expiration for now
      };
      client.emit('subresource:lock_acquired', acquiredDto);

      // Broadcast to room (other users)
      const lockedDto: SubResourceLockedDto = {
        resourceType,
        resourceUuid,
        subResourceId,
        userId: userId!,
        username: username!,
        lockedAt: acquiredDto.lockedAt,
        expiresAt: undefined,
      };
      client.to(roomId).emit('subresource:locked', lockedDto);

    } catch (error) {
      this.handleSocketError(error, client, 'surgery:subresource_lock_acquire');
    }
  }

  /**
   * Handle sub-resource lock release
   * 
   * Client → Server: surgery:subresource_lock_release
   * Server → Client: subresource:lock_released (success) OR socket:error (failure)
   * Server → Room: subresource:unlocked (broadcast to others)
   * 
   * Business Rules:
   * - User must own the lock
   * - Throws SocketException if not owner (LOCK_NOT_OWNED)
   * 
   * @param data - SubResourceUnlockDto with resourceUuid and subResourceId
   * @param client - Connected socket
   */
  @SubscribeMessage('surgery:subresource_lock_release')
  async handleSubResourceLockRelease(
    @MessageBody() data: SubResourceUnlockDto,
    @ConnectedSocket() client: TypedSocket,
  ): Promise<void> {
    try {
      const { resourceUuid, subResourceId } = data;
      const userId = client.data?.user?.userId;
      const username = client.data?.user?.username;
      const resourceType = 'surgery-management';
      const roomId = `${resourceType}:${resourceUuid}`;

      // Attempt to release lock
      const released = this.releaseSubResourceLock(
        resourceType,
        resourceUuid,
        subResourceId,
        userId!,
      );

      if (!released) {
        // Check if lock exists but not owned by user
        const existingLock = this.getSubResourceLock(resourceType, resourceUuid, subResourceId);
        if (existingLock && existingLock.userId !== userId) {
          throw new SocketException(
            SocketErrorCategory.AUTHORIZATION,
            'LOCK_NOT_OWNED',
            `You do not own the lock on sub-resource '${subResourceId}'`,
            { 
              currentOwner: existingLock.userId,
              attemptedBy: userId,
            },
          );
        }

        // Lock doesn't exist (already released or never acquired)
        throw new SocketException(
          SocketErrorCategory.NOT_FOUND,
          'LOCK_NOT_FOUND',
          `No lock found for sub-resource '${subResourceId}'`,
          { resourceUuid, subResourceId },
        );
      }

      // Emit success to requester
      const releasedDto: SubResourceLockReleasedDto = {
        resourceType,
        resourceUuid,
        subResourceId,
        userId: userId!,
        success: true,
        releasedAt: Date.now(),
      };
      client.emit('subresource:lock_released', releasedDto);

      // Broadcast to room (other users)
      const unlockedDto: SubResourceUnlockedDto = {
        resourceType,
        resourceUuid,
        subResourceId,
        userId: userId!,
        username: username,
        releasedAt: releasedDto.releasedAt,
        reason: 'manual',
      };
      client.to(roomId).emit('subresource:unlocked', unlockedDto);

    } catch (error) {
      this.handleSocketError(error, client, 'surgery:subresource_lock_release');
    }
  }

  // ============================================================================
  // TASK 10.4 - Rate Limiting Methods
  // ============================================================================

  /**
   * Check if client is allowed to perform event (rate limiting)
   * 
   * @param socketId - Client socket ID
   * @param eventType - Event type (e.g., 'room:join', 'surgery:lock')
   * @returns true if allowed, false if rate limit exceeded
   */
  private checkRateLimit(socketId: string, eventType: string): boolean {
    // Check if user is banned
    const ban = this.bannedUsers.get(socketId);
    if (ban) {
      if (Date.now() < ban.bannedUntil) {
        // Still banned
        return false;
      } else {
        // Ban expired, remove from banned list
        this.bannedUsers.delete(socketId);
        this.violations.delete(socketId);
      }
    }

    // Get or create rate limiter for this socket + event
    if (!this.rateLimiters.has(socketId)) {
      this.rateLimiters.set(socketId, new Map());
    }

    const socketLimiters = this.rateLimiters.get(socketId)!;
    
    if (!socketLimiters.has(eventType)) {
      // Get config for this event type (or default)
      const config = this.RATE_LIMITS[eventType] || this.RATE_LIMITS.default;
      socketLimiters.set(eventType, new RateLimiter(config));
    }

    const limiter = socketLimiters.get(eventType)!;
    return limiter.allow();
  }

  /**
   * Handle rate limit violation with progressive penalties
   * 
   * Progressive penalties:
   * - 1-2 violations: Warn client
   * - 3 violations: Warn + disconnect
   * - 5+ violations: Ban for 5 minutes
   * 
   * @param client - Client socket
   * @param eventType - Event type that was rate limited
   */
  private handleRateLimitViolation(client: TypedSocket, eventType: string): void {
    const socketId = client.id;
    const now = Date.now();

    // Get or create violation record
    let violationRecord = this.violations.get(socketId);
    
    if (!violationRecord) {
      violationRecord = { count: 0, lastViolation: now };
      this.violations.set(socketId, violationRecord);
    }

    // Check if violations expired (5 minutes since last violation)
    if (now - violationRecord.lastViolation > this.VIOLATION_EXPIRY) {
      // Reset count if expired
      violationRecord.count = 1;
      violationRecord.lastViolation = now;
    } else {
      // Increment count
      violationRecord.count++;
      violationRecord.lastViolation = now;
    }

    const violationCount = violationRecord.count;

    // Get rate limit config for this event
    const config = this.RATE_LIMITS[eventType] || this.RATE_LIMITS.default;
    const socketLimiters = this.rateLimiters.get(socketId);
    const limiter = socketLimiters?.get(eventType);
    const retryAfter = limiter ? config.window : 1000; // Fallback to 1s

    // Log violation
    this.logger.warn(JSON.stringify({
      event: 'RATE_LIMIT_VIOLATION',
      socketId,
      userId: client.data?.user?.userId,
      username: client.data?.user?.username,
      eventType,
      violationCount,
      retryAfter,
    }));

    // Progressive penalties
    if (violationCount >= 5) {
      // Ban for 5 minutes
      const bannedUntil = now + this.BAN_DURATION;
      this.bannedUsers.set(socketId, {
        bannedUntil,
        reason: 'RATE_LIMIT_ABUSE',
      });

      this.logger.warn(JSON.stringify({
        event: 'USER_BANNED',
        socketId,
        userId: client.data?.user?.userId,
        username: client.data?.user?.username,
        reason: 'RATE_LIMIT_ABUSE',
        duration: this.BAN_DURATION,
        violationCount,
      }));

      // Emit ban message
      client.emit('connection:banned', {
        reason: 'RATE_LIMIT_ABUSE',
        duration: this.BAN_DURATION,
        message: `Banned for ${this.BAN_DURATION / 60000} minutes due to rate limit abuse`,
        expiresAt: new Date(bannedUntil),
        violations: violationCount,
      } as ConnectionBannedDto);

      // Disconnect after ban message
      setTimeout(() => {
        client.disconnect(true);
      }, 100); // Small delay to ensure ban message is sent

    } else if (violationCount >= 3) {
      // Warn and disconnect
      client.emit('rate_limit_exceeded', {
        event: eventType,
        limit: config.limit,
        window: config.window,
        retryAfter,
        message: `Rate limit exceeded for ${eventType}. Disconnecting due to repeated violations.`,
        violations: violationCount,
      } as RateLimitExceededDto);

      this.logger.warn(JSON.stringify({
        event: 'RATE_LIMIT_DISCONNECT',
        socketId,
        userId: client.data?.user?.userId,
        username: client.data?.user?.username,
        eventType,
        violationCount,
      }));

      // Disconnect after warning
      setTimeout(() => {
        client.disconnect(true);
      }, 100);

    } else {
      // Just warn
      client.emit('rate_limit_exceeded', {
        event: eventType,
        limit: config.limit,
        window: config.window,
        retryAfter,
        message: `Rate limit exceeded for ${eventType}. Please wait ${retryAfter}ms before retrying.`,
        violations: violationCount,
      } as RateLimitExceededDto);
    }
  }

  /**
   * Cleanup rate limiting data for disconnected client
   * Called from onClientDisconnecting hook
   * 
   * @param socketId - Client socket ID
   */
  private cleanupRateLimitData(socketId: string): void {
    this.rateLimiters.delete(socketId);
    // Keep violations and bans for tracking across reconnections
    // They will expire naturally via VIOLATION_EXPIRY and BAN_DURATION
  }

  // ============================================================================
  // Test Utilities (Public access for testing)
  // ============================================================================

  /**
   * Get connection pool (for testing only)
   * @returns Connection pool map
   */
  getConnectionPool() {
    return this.connectionPool;
  }

  /**
   * Get connections by user ID (for testing only)
   * @param userId - User ID
   * @returns Array of socket IDs
   */
  getConnectionsByUser(userId: string): string[] {
    return this.getUserConnections(userId);
  }

  /**
   * Get connection metrics (for testing only)
   * @returns Connection metrics
   */
  getConnectionMetrics() {
    const totalConnections = this.connectionPool.size;
    const activeConnections = this.connectionPool.size;
    const uniqueUsers = new Set(
      Array.from(this.connectionPool.values()).map(conn => conn.userId)
    ).size;

    const connectionsByTransport: Record<string, number> = {};
    for (const conn of this.connectionPool.values()) {
      connectionsByTransport[conn.transport] = (connectionsByTransport[conn.transport] || 0) + 1;
    }

    // Initialize with 0 for common transports if not present
    if (!connectionsByTransport.websocket) {
      connectionsByTransport.websocket = 0;
    }
    if (!connectionsByTransport.polling) {
      connectionsByTransport.polling = 0;
    }

    return {
      totalConnections,
      activeConnections,
      uniqueUsers,
      connectionsByTransport,
    };
  }

  /**
   * TASK 10.4: Get rate limiting state (for testing only)
   * @returns Rate limiting state
   */
  getRateLimitState() {
    return {
      rateLimiters: this.rateLimiters,
      violations: this.violations,
      bannedUsers: this.bannedUsers,
      rateLimits: this.RATE_LIMITS,
    };
  }

  /**
   * TASK 10.4: Reset rate limiting state (for testing only)
   * Useful for cleaning up between tests
   */
  resetRateLimitState() {
    this.rateLimiters.clear();
    this.violations.clear();
    this.bannedUsers.clear();
  }

  /**
   * AREA 7.6: Get room users map for admin monitoring
   * Returns the internal roomUsers Map used for tracking users in rooms
   * @returns Map of roomId -> Map of socketId -> RoomUserDto
   */
  getRoomUsers(): Map<string, Map<string, RoomUserDto>> {
    return this.roomUsers;
  }

  // ============================================================================
  // AREA 9 - Activity Tracking Lifecycle Hooks
  // ============================================================================

  /**
   * Lifecycle hook: Called after gateway initialization
   * Starts the sweep job timer to check for stale locks
   */
  afterInit(server: any): void {
    // Call parent initialization first
    super.afterInit(server);

    const config = this.configService.getActivityTrackingConfig();

    this.sweepJobTimer = setInterval(() => {
      this.cleanupStaleLocks();
    }, config.sweepInterval);

    this.logger.log(
      JSON.stringify({
        event: 'SWEEP_JOB_STARTED',
        sweepInterval: config.sweepInterval,
        lockTTL: config.lockTTL,
        warningTime: config.warningTime,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Lifecycle hook: Called before application shutdown
   * Cleans up the sweep job timer
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.sweepJobTimer) {
      clearInterval(this.sweepJobTimer);
      this.sweepJobTimer = undefined;

      this.logger.log(
        JSON.stringify({
          event: 'SWEEP_JOB_STOPPED',
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  /**
   * Release all locks for a user (wrapper for activity tracking)
   * 
   * @param socketId - Socket ID of the user
   * @param userId - User ID (for logging)
   * @param reason - Reason for lock release (INACTIVITY_TIMEOUT, EXPLICIT_RELEASE, etc.)
   * @returns Array of released locks
   */
  private releaseAllLocksForUser(
    socketId: string,
    userId: string,
    reason: 'INACTIVITY_TIMEOUT' | 'EXPLICIT_RELEASE' | 'DISCONNECT',
  ): SubResourceLock[] {
    const releasedLocks = this.releaseAllSubResourceLocks(socketId);

    if (releasedLocks.length > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'ALL_LOCKS_RELEASED',
          userId,
          socketId,
          reason,
          locksCount: releasedLocks.length,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return releasedLocks;
  }

  /**
   * Sweep job: Check for stale locks and release them
   * Called every sweepInterval (default: 1 minute)
   * 
   * Logic:
   * 1. Iterate all users in all rooms
   * 2. Calculate inactiveTime = now - user.lastActivity
   * 3. If inactiveTime >= lockTTL - warningTime: emit 'lock:expiring_soon'
   * 4. If inactiveTime >= lockTTL: release locks + emit 'lock:expired' + broadcast 'lock:released'
   * 5. Log sweep statistics
   */
  private cleanupStaleLocks(): void {
    const config = this.configService.getActivityTrackingConfig();
    const now = Date.now();
    const warningThreshold = config.lockTTL - config.warningTime;
    const expiryThreshold = config.lockTTL;

    let totalUsers = 0;
    let warningsIssued = 0;
    let locksReleased = 0;

    // Iterate all rooms and users
    for (const [roomId, usersMap] of this.roomUsers.entries()) {
      for (const [socketId, user] of usersMap.entries()) {
        totalUsers++;
        const inactiveTime = now - user.lastActivity;

        // Check if lock is expiring soon
        if (inactiveTime >= warningThreshold && inactiveTime < expiryThreshold) {
          const remainingTime = config.lockTTL - inactiveTime;
          // TODO: Generic inactivity warning (NOT Area 7.4 sub-resource lock warning)
          // Should use different event/DTO for global inactivity warnings
          warningsIssued++;

          this.logger.warn(
            JSON.stringify({
              event: 'INACTIVITY_WARNING',
              userId: user.userId,
              username: user.username,
              roomId,
              inactiveTime,
              remainingTime,
              timestamp: new Date().toISOString(),
            }),
          );
        }

        // Check if lock has expired
        if (inactiveTime >= expiryThreshold) {
          // Release all locks for this user
          this.releaseAllLocksForUser(socketId, user.userId, 'INACTIVITY_TIMEOUT');

          // TODO: Generic inactivity expiration notification (NOT Area 7.4 sub-resource lock expiration)
          // Should use different event/DTO for global inactivity expiration

          // Broadcast lock:released to room
          const releasedDto: LockReleasedDto = {
            userId: user.userId,
            username: user.username,
            reason: 'INACTIVITY_TIMEOUT',
            roomId,
          };
          this.server.in(roomId).emit('lock:released', releasedDto);

          locksReleased++;

          this.logger.warn(
            JSON.stringify({
              event: 'LOCK_EXPIRED_INACTIVITY',
              userId: user.userId,
              username: user.username,
              roomId,
              inactiveTime,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      }
    }

    // Log sweep statistics (only if there was activity)
    if (warningsIssued > 0 || locksReleased > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'SWEEP_JOB_COMPLETED',
          totalUsers,
          warningsIssued,
          locksReleased,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  // ============================================================================
  // AREA 7.8 - Save/Revision Events (Real-time Notifications)
  // ============================================================================

  /**
   * Handles internal resource.updated events from any controller.
   * Transforms event into ResourceUpdatedDto and broadcasts to all clients in room.
   * 
   * Flow: Controller (REST API) → EventEmitter2 → Gateway → Socket.IO broadcast
   * 
   * Architecture: Generic resource update system, works for ANY resource type:
   * - surgery-management (gestione interventi)
   * - patient (pazienti)
   * - visit (visite ambulatoriali)
   * - surgery-request (richieste intervento)
   * - etc.
   * 
   * Use case: When user saves a resource via REST API (PATCH/PUT/DELETE),
   * all other users viewing the same resource receive real-time notification with:
   * - Who saved (username, userId)
   * - What changed (operation, subResourceId)
   * - New revision UUID
   * - Timestamp
   * 
   * Room format: {resourceType}:{resourceUuid}
   * Example: "surgery-management:550e8400-e29b-41d4-a716-446655440000"
   * 
   * @param event Internal event from any controller (SurgeryManagementController, PatientController, etc.)
   */
  @OnEvent('resource.updated')
  handleResourceUpdated(event: ResourceUpdateEventDto): void {
    try {
      // Build room ID from resourceType:resourceUuid format
      // Fully generic: works for ANY resource (surgery-management, patient, visit, etc.)
      const roomId = `${event.resourceType}:${event.resourceUuid}`;

      // Check if room exists (at least one user connected)
      if (!this.roomUsers.has(roomId)) {
        this.logger.debug(
          JSON.stringify({
            event: 'RESOURCE_UPDATED_NO_ROOM',
            resourceType: event.resourceType,
            resourceUuid: event.resourceUuid,
            operation: event.operation,
            timestamp: new Date().toISOString(),
            reason: 'No users in room, skipping broadcast',
          }),
        );
        return;
      }

      // Transform internal event to Socket.IO DTO
      const payload: ResourceUpdatedDto = {
        roomId,
        resourceType: event.resourceType,
        resourceId: event.resourceUuid,
        newRevisionId: event.resourceRevisionUuid,
        updatedBy: event.updatedBy,
        updatedByUserId: event.updatedByUserId,
        subResourceId: event.subResourceId,
        timestamp: event.timestamp,
        changesSummary: event.changesSummary || `${event.resourceType} ${event.operation}`,
      };

      // Broadcast to all clients in room
      this.server.to(roomId).emit('resource:updated', payload);

      this.logger.log(
        JSON.stringify({
          event: 'RESOURCE_UPDATED_BROADCAST',
          resourceType: event.resourceType,
          resourceUuid: event.resourceUuid,
          resourceRevisionUuid: event.resourceRevisionUuid,
          operation: event.operation,
          updatedBy: event.updatedBy,
          subResourceType: event.subResourceType,
          subResourceId: event.subResourceId,
          roomId,
          usersCount: this.roomUsers.get(roomId)?.size || 0,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'RESOURCE_UPDATED_ERROR',
          resourceType: event.resourceType,
          resourceUuid: event.resourceUuid,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}
