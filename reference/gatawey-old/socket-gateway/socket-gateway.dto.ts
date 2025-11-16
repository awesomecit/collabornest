/**
 * Authenticated User Data stored in client.data
 */
export interface AuthenticatedUser {
  userId: string; // sub from JWT
  username: string; // preferred_username
  firstName?: string; // given_name
  lastName?: string; // family_name
  email?: string;
  roles: string[]; // from realm_access.roles
}

/**
 * Client Metadata stored in client.data
 */
export interface ClientMetadata {
  ipAddress: string;
  userAgent: string;
  connectedAt: number; // timestamp
}

/**
 * Extended Socket.data with type safety
 */
export interface SocketData {
  user?: AuthenticatedUser;
  metadata?: ClientMetadata;
}

/**
 * Connection Pool Info
 * Task 1.2.5: Connection Pool Tracking
 */
export interface ConnectionInfo {
  socketId: string;
  userId: string;
  username: string;
  connectedAt: number;
  transport: string;
  metadata: ClientMetadata;
}

/**
 * Connection Metrics
 * Task 1.2.5: Connection Pool Tracking
 */
export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByTransport: {
    websocket: number;
    polling: number;
    [key: string]: number;
  };
}

/**
 * Graceful Shutdown Options
 * Task 1.2.6: Graceful Shutdown
 */
export interface GracefulShutdownOptions {
  timeout?: number; // Timeout in ms (default: 5000)
  message?: string; // Custom message to clients
  reconnectIn?: number; // Suggest reconnect delay (default: 5000)
}

/**
 * Disconnect Reason Category
 * Task 1.2.3: Enhanced Disconnect Reason Detection
 */
export enum DisconnectCategory {
  VOLUNTARY = 'VOLUNTARY',     // Client intentionally disconnected
  TIMEOUT = 'TIMEOUT',         // Ping timeout (zombie connection)
  ERROR = 'ERROR',             // Transport/network error
  FORCED = 'FORCED',           // Server forced disconnect
  UNKNOWN = 'UNKNOWN',         // Unrecognized reason
}

/**
 * Parsed Disconnect Reason
 * Task 1.2.3: Enhanced Disconnect Reason Detection
 */
export interface DisconnectReason {
  raw: string;                    // Raw Socket.IO reason
  category: DisconnectCategory;   // Categorized reason
  description: string;            // Human-readable description
  logLevel: 'info' | 'warn' | 'error'; // Appropriate log level
}

// ============================================================================
// Room Management DTOs
// ============================================================================

/**
 * Join Room DTO
 * 
 * Client → Server event: room:join
 * 
 * RoomId Format: {resourceType}:{resourceId}
 * Examples:
 * - surgery-management:550e8400-e29b-41d4-a716-446655440000
 * - visit:12345
 * - consultation:abc-def-ghi
 */
export interface JoinRoomDto {
  roomId: string; // Generic room identifier
}

/**
 * Leave Room DTO
 * 
 * Client → Server event: room:leave
 */
export interface LeaveRoomDto {
  roomId: string;
}

/**
 * Query Room Users DTO
 * 
 * Client → Server event: room:query_users
 */
export interface QueryRoomUsersDto {
  roomId: string;
}

/**
 * Room User DTO
 * 
 * Represents a user in a room (used in responses)
 * 
 * Area 7.2: Extended with presence tracking (currentSubResource, lastActivity)
 */
export interface RoomUserDto {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  socketId: string;
  joinedAt: number; // timestamp
  currentSubResource?: SubResourceType; // Area 7.2: Current sub-resource TYPE user is viewing (not ID, but category like 'anestesia', 'paziente')
  lastActivity?: number; // Area 7.2: Timestamp of last activity (for zombie detection)
}

/**
 * Room Joined Response DTO
 * 
 * Server → Client event: room:joined
 */
export interface RoomJoinedDto {
  roomId: string;
  userId: string;
  username: string;
  success: boolean;
  joinedAt: number;
  currentUsers?: number; // Task 10.2: Room capacity info
  maxUsers?: number;     // Task 10.2: Room capacity limit
  users?: RoomUserDto[]; // Area 7.1: List of all users currently in room
  
  /**
   * Auto-lock result (if initialSubResourceId was provided in join request)
   * 
   * @since v1.2.0
   */
  autoLock?: {
    /** Whether lock was successfully acquired */
    acquired: boolean;
    
    /** Sub-resource ID that was locked (or attempted) */
    subResourceId: string;
    
    /** Timestamp when lock was acquired (if acquired=true) */
    lockedAt?: string;
    
    /** Reason for lock denial (if acquired=false) */
    denialReason?: string;
    
    /** User who currently holds the lock (if acquired=false) */
    lockedBy?: {
      userId: string;
      username: string;
      socketId: string;
    };
  };
}

/**
 * User Joined Room Notification DTO
 * 
 * Server → Client event: user_joined
 * Sent to all OTHER users in the room
 */
export interface UserJoinedRoomDto {
  roomId: string;
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  socketId: string;
  joinedAt: number;
}

/**
 * Room Left Response DTO
 * 
 * Server → Client event: room:left
 */
export interface RoomLeftDto {
  roomId: string;
  userId: string;
  success: boolean;
  message?: string;
}

/**
 * User Left Room DTO
 * 
 * Server → Client event: user_left
 * Sent to all OTHER users in the room
 */
export interface UserLeftRoomDto {
  roomId: string;
  userId: string;
  username: string;
  reason?: 'manual' | 'disconnect' | 'logout'; // Manual leave, connection lost, or voluntary logout
}

/**
 * Room Users Response DTO
 * 
 * Server → Client event: room:users
 * 
 * TASK 10.2: Added capacity information
 */
export interface RoomUsersDto {
  roomId: string;
  users: RoomUserDto[];
  capacity?: {
    current: number;      // Current users in room
    max: number;          // Maximum users allowed
    percentageUsed: number; // Percentage of capacity used (e.g., 75)
  };
}

/**
 * Room Join Rejected DTO
 * 
 * Server → Client event: room:join_rejected
 * 
 * TASK 10.2: Emitted when room is full or user cannot join.
 */
export interface RoomJoinRejectedDto {
  roomId: string;
  reason: 'ROOM_FULL' | 'UNAUTHORIZED' | 'INVALID_ROOM';
  currentUsers?: number;    // Current users in room
  maxUsers?: number;        // Maximum users allowed
  message: string;          // Human-readable error message
}

/**
 * Room Capacity Warning DTO
 * 
 * Server → Client event: room:capacity_warning
 * 
 * TASK 10.2: Emitted when room reaches 90% capacity.
 * Allows clients to show warning UI.
 */
export interface RoomCapacityWarningDto {
  roomId: string;
  currentUsers: number;     // Current users in room
  maxUsers: number;         // Maximum users allowed
  percentageUsed: number;   // Percentage of capacity used (e.g., 90)
  message: string;          // Human-readable warning message
}

/**
 * Room Error DTO
 * 
 * Server → Client event: room:error
 */
export interface RoomErrorDto {
  error: string;
  message: string;
  roomId?: string;
}

/**
 * Resource Update Event DTO (Internal Event)
 * 
 * Internal event: resource.updated
 * 
 * DTO interno GENERICO usato da QUALSIASI controller per notificare il gateway
 * di un aggiornamento su una risorsa. Il controller emette questo evento via EventEmitter2,
 * il gateway lo ascolta con @OnEvent e lo trasforma in ResourceUpdatedDto
 * per broadcast Socket.IO.
 * 
 * Architettura generica: Supporta qualsiasi tipo di risorsa SISOS:
 * - surgery-management (gestione interventi)
 * - patient (pazienti)
 * - visit (visite ambulatoriali)
 * - surgery-request (richieste intervento)
 * - etc.
 * 
 * Flusso: Controller → EventEmitter2 → Gateway → Socket.IO broadcast
 */
export interface ResourceUpdateEventDto {
  resourceType: string;        // Tipo risorsa (es: 'surgery-management', 'patient', 'visit')
  resourceUuid: string;        // UUID risorsa principale aggiornata
  resourceRevisionUuid: string; // UUID nuova revisione creata
  updatedBy: string;           // Username dell'utente che ha salvato
  updatedByUserId: string;     // UserId dell'utente che ha salvato
  operation: string;           // Operazione eseguita (update, suspend, reopen, start, close, delete, etc.)
  subResourceType?: string;    // Tipo sub-resource (opzionale, es: 'data', 'anesthesia', 'patient-info')
  subResourceId?: string;      // ID sub-resource aggiornata (opzionale, es: 'data-tab', 'anesthesia-tab')
  status?: string;             // Nuovo status della risorsa (opzionale)
  timestamp: number;           // Timestamp aggiornamento
  changesSummary?: string;     // Descrizione breve modifiche (opzionale)
}

/**
 * Surgery Management Update Event DTO (Specific Implementation)
 * 
 * DTO specifico per surgery-management che estende ResourceUpdateEventDto.
 * Aggiunge campi specifici per la gestione interventi se necessario.
 * 
 * NOTA: Attualmente è un alias di ResourceUpdateEventDto, ma può essere
 * esteso in futuro con campi specifici per surgery-management.
 */
export interface SurgeryManagementUpdateEventDto extends ResourceUpdateEventDto {
  // Campi specifici per surgery-management possono essere aggiunti qui
  // Esempio: surgeryDate?: string, operatorUuid?: string, etc.
}

/**
 * @deprecated Use SurgeryManagementUpdateEventDto instead
 * Mantenuto per backward compatibility temporanea
 */
export interface SurgeryUpdateEventDto extends SurgeryManagementUpdateEventDto {
  surgeryUuid?: string;        // @deprecated Use resourceUuid
  revisionUuid?: string;       // @deprecated Use resourceRevisionUuid
}

/**
 * Resource Updated DTO
 * 
 * Server → Client event: resource:updated
 * 
 * Notifica broadcast quando una risorsa viene aggiornata (con nuova revisione)
 * tramite API REST. Il controller emette un evento interno che viene catturato
 * dal gateway e propagato a tutti gli utenti nella room.
 * 
 * Esempio: Client salva surgery-management via PATCH, controller crea revisione
 * e notifica tutti i collaboratori in tempo reale.
 */
export interface ResourceUpdatedDto {
  roomId: string;              // Room interessata (es: "surgery-management:uuid")
  resourceType: string;        // Tipo di risorsa (es: "surgery-management")
  resourceId: string;          // UUID risorsa principale
  newRevisionId: string;       // UUID nuova revisione creata
  updatedBy: string;           // Username dell'utente che ha salvato
  updatedByUserId: string;     // UserId dell'utente che ha salvato
  subResourceId?: string;      // Sub-resource aggiornata (opzionale, es: 'anestesia', 'paziente')
  timestamp: number;           // Timestamp aggiornamento
  changesSummary?: string;     // Descrizione breve modifiche (opzionale)
}

// ============================================================================
// Resource Collaboration DTOs (Area 7.1 - Business Logic)
// ============================================================================

/**
 * Resource Join DTO
 * 
 * Generic DTO for joining any SISOS resource room.
 * Usa campo 'uuid' standard per consistenza.
 * 
 * Used by:
 * - surgery:join → SurgeryManagement
 * - patient:join → Patient (future)
 * - visit:join → Visit (future)
 * 
 * Il gateway converte internamente a roomId = '{resourceType}:{uuid}'.
 * Output: usa RoomJoinedDto generico (già esistente)
 */
export interface ResourceJoinDto {
  uuid: string; // UUID della risorsa (campo standard SISOS per tutte le entità)
  
  /**
   * Optional: Initial sub-resource ID to auto-lock on join
   * @since v1.2.0
   */
  initialSubResourceId?: SurgerySubResourceType;
}

/**
 * Resource Leave DTO
 * 
 * Generic DTO for leaving any SISOS resource room.
 * 
 * Used by:
 * - surgery:leave → SurgeryManagement
 * - patient:leave → Patient (future)
 * - visit:leave → Visit (future)
 * 
 * Output: usa RoomLeftDto generico (già esistente)
 */
export interface ResourceLeaveDto {
  uuid: string;
}

// ============================================
// NEW: Generic Resource API (Alias Pattern)
// ============================================

/**
 * Resource Type Enum
 * 
 * Supported resource types for generic resource:* events.
 * 
 * ARCHITECTURE: Use module/use-case name, not entity name.
 * - surgery-management = gestione intervento (use case corrente)
 * - surgery-request = richiesta intervento (future)
 * - surgery = anagrafica chirurgica (future)
 * - outpatient-visit = visita ambulatoriale (future)
 * - patient = gestione paziente (future)
 */
export type ResourceType =
  | 'surgery-management'
  | 'surgery-request'
  | 'surgery'
  | 'outpatient-visit'
  | 'patient';

/**
 * Generic Resource Join DTO
 * 
 * NEW generic API for joining any resource type.
 * Replaces specific events: surgery:join, patient:join, etc.
 * 
 * Client → Server event: resource:join
 * 
 * BACKWARD COMPATIBILITY:
 * - Old API (surgery:join with uuid) still works
 * - New API (resource:join with resourceType + resourceUuid) recommended
 * 
 * Example:
 * ```typescript
 * // OLD (still works)
 * socket.emit('surgery:join', { uuid: 'abc-123' });
 * 
 * // NEW (recommended)
 * socket.emit('resource:join', {
 *   resourceType: 'surgery-management',
 *   resourceUuid: 'abc-123'
 * });
 * ```
 * 
 * Output: RoomJoinedDto (generic, unchanged)
 */
export interface GenericResourceJoinDto {
  /** Resource type (e.g., 'surgery-management', 'outpatient-visit') */
  resourceType: ResourceType;
  
  /** UUID of the resource */
  resourceUuid: string;
  
  /** 
   * Optional sub-resource ID to auto-lock on join
   * 
   * If provided, backend will:
   * 1. Set currentSubResource = initialSubResourceId
   * 2. Attempt to acquire lock on this sub-resource
   * 3. Return lock status in ACK (autoLock field)
   * 
   * Use case: User opens page directly on specific tab (e.g., from URL param)
   * Example: /surgery-management/abc-123?tab=data-tab
   * 
   * @since v1.2.0
   */
  initialSubResourceId?: SurgerySubResourceType;
}

/**
 * Generic Resource Leave DTO
 * 
 * NEW generic API for leaving any resource type.
 * 
 * Client → Server event: resource:leave
 * 
 * Output: RoomLeftDto (generic, unchanged)
 */
export interface GenericResourceLeaveDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** UUID of the resource */
  resourceUuid: string;
}

/**
 * Generic Sub-Resource Lock DTO
 * 
 * NEW generic API for locking sub-resources (tabs, sections).
 * Replaces: surgery:subresource_lock_acquire, etc.
 * 
 * Client → Server event: resource:subresource_lock
 * 
 * Example:
 * ```typescript
 * // OLD (still works)
 * socket.emit('surgery:subresource_lock_acquire', {
 *   resourceUuid: 'abc-123',
 *   subResourceId: 'tab-anagrafica'
 * });
 * 
 * // NEW (recommended)
 * socket.emit('resource:subresource_lock', {
 *   resourceType: 'surgery-management',
 *   resourceUuid: 'abc-123',
 *   subResourceId: 'tab-anagrafica'
 * });
 * ```
 * 
 * Output: SubResourceLockAcquiredDto or SubResourceLockDeniedDto
 */
export interface GenericSubResourceLockDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier (e.g., 'tab-anagrafica', 'section-diagnosis') */
  subResourceId: string;
}

/**
 * Generic Sub-Resource Unlock DTO
 * 
 * NEW generic API for releasing sub-resource locks.
 * 
 * Client → Server event: resource:subresource_unlock
 * 
 * Output: SubResourceLockReleasedDto
 */
export interface GenericSubResourceUnlockDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
}

/**
 * Resource Join Rejected DTO
 * 
 * Generic DTO for resource join rejection with business-specific reasons.
 * 
 * Used by:
 * - surgery:join_rejected → SurgeryManagement (Area 7.1)
 * - patient:join_rejected → Patient (future)
 * - visit:join_rejected → Visit (future)
 * 
 * Reason codes (resource-specific):
 * - {RESOURCE}_NOT_FOUND: Risorsa non esiste
 * - {RESOURCE}_CLOSED: Stato non permette accesso (es. VALIDATED, CANCELLED)
 * - ROOM_FULL: Capacity limit raggiunto (Task 10.2)
 * - UNAUTHORIZED: User non autorizzato
 * 
 * NOTE: Più specifico di RoomJoinRejectedDto generico perché include
 * resourceStatus per business logic validation.
 */
export interface ResourceJoinRejectedDto {
  uuid: string;                // UUID della risorsa
  reason: string;              // Reason code (es: 'SURGERY_NOT_FOUND', 'PATIENT_CLOSED', etc.)
  message: string;             // Human-readable error message
  currentUsers?: number;       // Current users in room (if ROOM_FULL)
  maxUsers?: number;           // Max users allowed (if ROOM_FULL)
  resourceStatus?: string;     // Current resource status (if {RESOURCE}_CLOSED)
  resourceType?: string;       // Resource type (es: 'surgery-management', 'patient', etc.)
}

// ============================================
// TASK 10.1 - Connection Limits DTOs
// ============================================

/**
 * Connection Rejected DTO
 * 
 * Emitted when user exceeds max connections limit.
 * Client receives this before being forcefully disconnected.
 */
export interface ConnectionRejectedDto {
  reason: 'MAX_CONNECTIONS_EXCEEDED' | 'AUTHENTICATION_FAILED' | 'BANNED';
  limit?: number;              // Max connections allowed
  current?: number;            // Current connections count
  message: string;             // Human-readable error message
  retryAfter?: number;         // Milliseconds to wait before retry (for banned users)
}

/**
 * Connection Warning DTO
 * 
 * Emitted when user approaches max connections limit (e.g., 80%).
 * Allows client to show warning UI before hitting hard limit.
 */
export interface ConnectionWarningDto {
  limit: number;               // Max connections allowed
  current: number;             // Current connections count
  percentageUsed: number;      // Percentage of limit used (e.g., 80)
  message: string;             // Human-readable warning message
}

// ============================================
// TASK 8.3 - Error Handling DTOs
// ============================================

/**
 * Socket Error Category
 * 
 * Categorizes errors for better client handling and logging.
 */
export enum SocketErrorCategory {
  VALIDATION = 'VALIDATION',           // Invalid input data (client error)
  AUTHORIZATION = 'AUTHORIZATION',     // Permission denied (client error)
  NOT_FOUND = 'NOT_FOUND',            // Resource not found (client error)
  CONFLICT = 'CONFLICT',              // State conflict (e.g., room full, lock held)
  INTERNAL = 'INTERNAL',              // Server error (unexpected)
  TIMEOUT = 'TIMEOUT',                // Operation timeout
  RATE_LIMIT = 'RATE_LIMIT',          // Too many requests
}

/**
 * Socket Error DTO
 * 
 * Server → Client event: socket:error
 * 
 * Standardized error format for all socket operations.
 * Provides structured error information without disconnecting client.
 * 
 * Error Categories:
 * - VALIDATION: Invalid input (400-like) - client should fix input
 * - AUTHORIZATION: Permission denied (403-like) - client lacks permission
 * - NOT_FOUND: Resource not found (404-like) - resource doesn't exist
 * - CONFLICT: State conflict (409-like) - operation conflicts with current state
 * - INTERNAL: Server error (500-like) - unexpected error, client can retry
 * - TIMEOUT: Operation timeout - client should retry
 * - RATE_LIMIT: Too many requests - client should backoff
 * 
 * Client Handling Example:
 * ```typescript
 * socket.on('socket:error', (error: SocketErrorDto) => {
 *   switch (error.category) {
 *     case 'VALIDATION':
 *       // Show validation error in UI
 *       showToast('error', error.message);
 *       break;
 *     case 'AUTHORIZATION':
 *       // Redirect to login or show permission error
 *       showPermissionDenied(error.message);
 *       break;
 *     case 'INTERNAL':
 *       // Show generic error, enable retry button
 *       showErrorWithRetry(error.message);
 *       break;
 *     default:
 *       // Fallback handling
 *       console.error('Socket error:', error);
 *   }
 * });
 * ```
 */
export interface SocketErrorDto {
  category: SocketErrorCategory;   // Error category for client handling
  errorCode: string;               // Machine-readable error code (e.g., 'ROOM_NOT_FOUND')
  message: string;                 // Human-readable error message
  details?: any;                   // Additional error details (optional)
  timestamp: number;               // Error timestamp
  socketId: string;                // Socket ID where error occurred
  userId?: string;                 // User ID if authenticated
  eventName?: SocketEventName;     // Event name that triggered error (type-safe)
  requestId?: string;              // Request ID for tracking (optional)
}

// ============================================
// TASK 10.4 - Rate Limiting DTOs
// ============================================

/**
 * Rate Limit Exceeded DTO
 * 
 * Emitted when client exceeds rate limit for a specific event type.
 * Client should back off and retry after specified delay.
 * 
 * Example emission:
 * ```typescript
 * client.emit('rate_limit_exceeded', {
 *   event: 'room:join',
 *   limit: 2,
 *   window: 5000,
 *   retryAfter: 3000,
 *   message: 'Too many room join attempts. Please wait before retrying.'
 * });
 * ```
 */
export interface RateLimitExceededDto {
  /** Event type that was rate limited (e.g., 'room:join', 'surgery:lock') */
  event: string;
  
  /** Maximum requests allowed in time window */
  limit: number;
  
  /** Time window in milliseconds */
  window: number;
  
  /** Milliseconds to wait before retry */
  retryAfter: number;
  
  /** Human-readable error message */
  message: string;
  
  /** Number of violations so far (for progressive penalties) */
  violations?: number;
}

/**
 * Connection Banned DTO
 * 
 * Emitted when client is banned due to repeated rate limit violations.
 * Connection will be forcefully closed after this message.
 * 
 * Ban reasons:
 * - RATE_LIMIT_ABUSE: Too many rate limit violations
 * - MALICIOUS_BEHAVIOR: Detected abuse patterns
 * 
 * Example emission:
 * ```typescript
 * client.emit('connection:banned', {
 *   reason: 'RATE_LIMIT_ABUSE',
 *   duration: 300000, // 5 minutes
 *   message: 'Banned for 5 minutes due to rate limit abuse',
 *   expiresAt: new Date(Date.now() + 300000)
 * });
 * ```
 */
export interface ConnectionBannedDto {
  /** Reason for ban */
  reason: 'RATE_LIMIT_ABUSE' | 'MALICIOUS_BEHAVIOR';
  
  /** Ban duration in milliseconds */
  duration: number;
  
  /** Human-readable message */
  message: string;
  
  /** When ban expires (for client display) */
  expiresAt: Date;
  
  /** Number of violations that triggered ban */
  violations?: number;
}

// ============================================================================
// Sub-Resource Lock DTOs (Area 7.3)
// ============================================================================

/**
 * Sub-Resource Lock DTO (Area 7.3)
 * 
 * Client → Server event: surgery:subresource_lock_acquire (or {resourceType}:subresource_lock_acquire)
 * 
 * Architecture:
 * - Resource: Parent entity (Surgery, Patient, Visit, Exam, etc.)
 * - Sub-Resource: Child entity (Anestesia, Paziente, Diagnosi section, etc.)
 * - Hierarchy: Resource → Sub-Resource (no further nesting, like a mule 🐴)
 * - Lock Key: {resourceType}:{resourceUuid}:{subResourceId}
 * 
 * Examples:
 * - surgery-management:550e8400-e29b-41d4-a716-446655440000:anestesia
 * - surgery-management:550e8400-e29b-41d4-a716-446655440000:paziente
 * - patient:12345:anagrafica
 * - visit:abc-def:diagnosi
 * 
 * Naming Note:
 * - subResourceId here is actually a TYPE/CATEGORY identifier (e.g., 'anestesia')
 * - NOT a numeric ID, but a string representing the section/child entity type
 * - Kept as "Id" for API backward compatibility and brevity
 * - See SubResourceType for known types
 * 
 * Business Rules:
 * - User must be in room (joined resource) to acquire lock
 * - 1 sub-resource = 1 lock (exclusive access)
 * - Lock auto-released on disconnect
 * - Lock ownership validated on release
 * - Cross-resource isolation enforced
 */
export interface SubResourceLockDto {
  /** UUID of parent resource (e.g., surgery UUID) */
  resourceUuid: string;
  
  /** Sub-resource type identifier (e.g., 'anestesia', 'paziente', 'diagnosi') - NOT a numeric ID */
  subResourceId: string;
}

/**
 * Sub-Resource Unlock DTO
 * 
 * Client → Server event: surgery:subresource_lock_release (or {resourceType}:subresource_lock_release)
 */
export interface SubResourceUnlockDto {
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier to unlock */
  subResourceId: string;
}

/**
 * Sub-Resource Lock Acquired Response DTO
 * 
 * Server → Client event: subresource:lock_acquired
 * 
 * Emitted to requester when lock successfully acquired.
 */
export interface SubResourceLockAcquiredDto {
  /** Resource type (e.g., 'surgery-management') */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User ID who acquired lock */
  userId: string;
  
  /** Username for display */
  username: string;
  
  /** Success flag */
  success: boolean;
  
  /** When lock was acquired (timestamp) */
  lockedAt: number;
  
  /** Optional: When lock expires (null = no expiration) */
  expiresAt?: number;
}

/**
 * Sub-Resource Lock Denied Response DTO
 * 
 * Server → Client event: subresource:lock_denied
 * 
 * Emitted to requester when lock acquisition fails.
 * 
 * Denial reasons:
 * - SUBRESOURCE_ALREADY_LOCKED: Another user holds the lock
 * - USER_NOT_IN_ROOM: User must join room first
 * - INVALID_SUBRESOURCE_ID: Empty or malformed subResourceId
 * - RESOURCE_NOT_FOUND: Parent resource doesn't exist
 * - RESOURCE_CLOSED: Parent resource in closed state (VALIDATED, CANCELLED, etc.)
 */
export interface SubResourceLockDeniedDto {
  /** Resource type */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Denial reason code */
  reason: 'SUBRESOURCE_ALREADY_LOCKED' | 'USER_NOT_IN_ROOM' | 'INVALID_SUBRESOURCE_ID' | 'RESOURCE_NOT_FOUND' | 'RESOURCE_CLOSED';
  
  /** Human-readable message */
  message: string;
  
  /** Current lock holder info (if reason is SUBRESOURCE_ALREADY_LOCKED) */
  currentLockHolder?: {
    userId: string;
    username: string;
    lockedAt: number;
    expiresAt?: number;
  };
}

/**
 * Sub-Resource Locked Notification DTO
 * 
 * Server → Room event: subresource:locked
 * 
 * Broadcast to all OTHER users in room when sub-resource is locked.
 */
export interface SubResourceLockedDto {
  /** Resource type */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User ID who acquired lock */
  userId: string;
  
  /** Username for display */
  username: string;
  
  /** When lock was acquired */
  lockedAt: number;
  
  /** Optional: When lock expires */
  expiresAt?: number;
}

/**
 * Sub-Resource Lock Released Response DTO
 * 
 * Server → Client event: subresource:lock_released
 * 
 * Emitted to requester when lock successfully released.
 */
export interface SubResourceLockReleasedDto {
  /** Resource type */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User ID who released lock */
  userId: string;
  
  /** Success flag */
  success: boolean;
  
  /** When lock was released */
  releasedAt: number;
}

/**
 * Sub-Resource Unlocked Notification DTO
 * 
 * Server → Room event: subresource:unlocked
 * 
 * Broadcast to all OTHER users in room when sub-resource is unlocked.
 * 
 * Unlock reasons:
 * - manual: User explicitly released lock
 * - disconnect: User disconnected (auto-release)
 * - timeout: Lock expired (if expiration enabled)
 * - forced: Admin or system forced release
 */
export interface SubResourceUnlockedDto {
  /** Resource type */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User ID who held the lock */
  userId: string;
  
  /** Username for display */
  username?: string;
  
  /** When lock was released */
  releasedAt: number;
  
  /** Reason for unlock */
  reason?: 'manual' | 'disconnect' | 'logout' | 'timeout' | 'forced';
}

/**
 * Sub-Resource Lock State (Internal - not emitted)
 * 
 * Stored in gateway's subResourceLocks Map.
 * Lock key format: {resourceType}:{resourceUuid}:{subResourceId}
 */
export interface SubResourceLock {
  /** Resource type */
  resourceType: string;
  
  /** UUID of parent resource */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** User ID who holds lock */
  userId: string;
  
  /** Username for display */
  username: string;
  
  /** Socket ID for cleanup on disconnect */
  socketId: string;
  
  /** When lock was acquired */
  lockedAt: number;
  
  /** Optional: When lock expires (null = no expiration) */
  expiresAt?: number;
}

// ============================================================================
// Area 7.2: Presence Management DTOs
// ============================================================================

/**
 * Sub-Resource Type
 * 
 * Type-safe representation of known sub-resource types.
 * Each resource type (Surgery, Patient, Visit, etc.) has specific sub-resources.
 * 
 * Note: This is NOT an ID but a TYPE/CATEGORY identifier.
 * 
 * Format alternatives considered:
 * 1. Current: subResourceType as string (e.g., 'anestesia', 'paziente')
 * 2. REST-like: {resourceType}:{resourceUuid}:{subResourceType} (more explicit, but verbose)
 * 
 * Current approach chosen for:
 * - Simplicity and brevity
 * - Room context already provides resourceType and resourceUuid
 * - Client flexibility (no need to construct complex keys)
 * 
 * Future: Can extend to REST-like format if cross-resource sub-resource tracking needed.
 */

/** Known Surgery Management sub-resource types */
/**
 * Surgery Management Sub-Resource Types
 * 
 * These are the ACTUAL tab IDs used in surgery-management frontend and backend.
 * Sync with: src/surgery-management/types/surgery-management-tabs.types.ts
 * 
 * Used for:
 * - presence:set_current_subresource (currentSubResource field)
 * - resource:subresource_lock (subResourceId field)
 * - resource:updated event (subResourceId field)
 */
export type SurgerySubResourceType = 
  | 'data-tab'                  // Dati Base
  | 'detail-tab'                // Dati Dettaglio
  | 'technical-data-tab'        // Dati Tecnici
  | 'operators-tab'             // Operatori
  | 'diagnosis-tab'             // Diagnosi
  | 'exams-tab'                 // Esami
  | 'infusions-tab'             // Infusioni
  | 'procedures-tab'            // Procedure
  | 'chirurgicalact-tab'        // Atto Chirurgico
  | 'materials-tab'             // Materiali
  | 'implantables-tab'          // Impiantabili
  | 'path-tab'                  // Percorso Operatorio (PO)
  | 'anesthesis-folder-tab'     // Cartella Anestesiologica (CA)
  | 'nursing-folder-tab'        // Cartella Infermieristica (CI)
  | 'anesthesis-tab'            // Anestesia
  | 'anesthesis-path-tab'       // Percorso Anestesiologico
  | 'patient-path-tab'          // Percorso Paziente
  | 'validation-tab';           // Validazione

/** Known Patient sub-resource types (future) */
export type PatientSubResourceType = 
  | 'anagrafica'          // Personal data section
  | 'contatti'            // Contacts section
  | 'documenti';          // Documents section

/** Generic sub-resource type (union of all known types) */
export type SubResourceType = 
  | SurgerySubResourceType 
  | PatientSubResourceType
  | string; // Allow custom types for extensibility

/**
 * Presence Event Type
 * 
 * Type-safe enum for presence update events
 */
export type PresenceEventType = 'user_joined' | 'user_left' | 'subresource_changed' | 'activity_updated';

/**
 * Socket Event Name
 * 
 * Type-safe union of all WebSocket event names in the system.
 * Includes both client → server and server → client events.
 * 
 * Client → Server (handlers):
 * - Room management: room:join, room:leave, room:query_users
 * - Resource collaboration: surgery:join, surgery:leave
 * - Presence: presence:set_current_subresource
 * - Sub-resource locks: surgery:subresource_lock_acquire, surgery:subresource_lock_release
 * 
 * Server → Client (emitted):
 * - Room responses: room:joined, room:left, room:users, room:join_rejected, room:capacity_warning
 * - User notifications: user_joined, user_left
 * - Presence updates: presence:updated
 * - Lock responses: subresource:lock_acquired, subresource:lock_denied, subresource:lock_released
 * - Lock notifications: subresource:locked, subresource:unlocked
 * - Resource collaboration: surgery:join_rejected
 * - Errors: socket:error, rate_limit_exceeded, connection:banned
 */
export type SocketEventName = 
  // Client → Server (handlers)
  | 'room:join'
  | 'room:leave'
  | 'room:query_users'
  | 'surgery:join'
  | 'surgery:leave'
  | 'presence:set_current_subresource'
  | 'surgery:subresource_lock_acquire'
  | 'surgery:subresource_lock_release'
  | 'lock:extend' // Area 7.4: Lock timeout & warning
  | 'resource:subresource_lock:force_request' // Area 7.5: Lock force request
  | 'resource:subresource_lock:force_response' // Area 7.5: Lock force request
  // Server → Client (responses)
  | 'room:joined'
  | 'room:left'
  | 'room:users'
  | 'room:join_rejected'
  | 'room:capacity_warning'
  | 'user_joined'
  | 'user_left'
  | 'presence:updated'
  | 'subresource:lock_acquired'
  | 'subresource:lock_denied'
  | 'subresource:lock_released'
  | 'subresource:locked'
  | 'subresource:unlocked'
  | 'surgery:join_rejected'
  | 'lock:extended' // Area 7.4: Lock timeout & warning
  | 'lock:expiring_soon' // Area 7.4: Lock timeout & warning
  | 'lock:expired' // Area 7.4: Lock timeout & warning
  | 'resource:subresource_lock:force_request_received' // Area 7.5: Lock force request
  | 'resource:subresource_lock:force_request_pending' // Area 7.5: Lock force request
  | 'resource:subresource_lock:force_request_approved' // Area 7.5: Lock force request
  | 'resource:subresource_lock:force_request_rejected' // Area 7.5: Lock force request
  // Error events
  | 'socket:error'
  | 'rate_limit_exceeded'
  | 'connection:banned';

/**
 * Set Current Sub-Resource DTO (Area 7.2 - Presence Management)
 * 
 * Client -> Server event: presence:set_current_subresource
 * 
 * Allows client to communicate which sub-resource/child entity they are currently viewing/editing.
 * Updates presence state and broadcasts presence:updated to room members.
 * 
 * Architecture Note:
 * - subResourceType is NOT an ID but a TYPE/CATEGORY identifier
 * - Examples: 'anestesia', 'paziente', 'anagrafica', 'diagnosi'
 * - Room context already provides resourceType and resourceUuid
 * - Format: simple string for brevity (REST-like format considered but deemed verbose)
 */
export interface SetCurrentSubResourceDto {
  /** Room ID (format: {resourceType}:{resourceUuid}) */
  roomId: string;
  
  /** Sub-resource type being viewed/edited (e.g., 'anestesia', 'paziente', 'anagrafica') */
  subResourceType: SubResourceType;
}

/**
 * Presence Update DTO
 * 
 * Server -> Client event: presence:updated
 * 
 * Broadcast to all room members when presence changes:
 * - User joins room (user_joined)
 * - User leaves room (user_left)
 * - User changes current sub-resource (subresource_changed)
 * - User activity detected (activity_updated)
 */
export interface PresenceUpdateDto {
  /** Room ID */
  roomId: string;
  
  /** Complete list of users currently in room with presence info */
  users: RoomUserDto[];
  
  /** Type of presence event that triggered this update */
  eventType: PresenceEventType;
  
  /** User ID that triggered the update (if applicable) */
  triggerUserId?: string;
  
  /** Timestamp of update */
  timestamp: number;
}

// ============================================================================
// ADMIN & MONITORING DTOs (Area 7.6)
// ============================================================================

/**
 * WebSocket Metrics DTO
 * 
 * GET /api/metrics/websocket
 * 
 * Provides high-level metrics about WebSocket gateway status
 */
export interface WebSocketMetricsDto {
  /** Total connections since server start */
  totalConnections: number;
  
  /** Currently active connections */
  activeConnections: number;
  
  /** Breakdown by transport type */
  connectionsByTransport: {
    websocket: number;
    polling: number;
  };
  
  /** Number of connections per user ID */
  connectionsByUser: Record<string, number>;
  
  /** Maximum allowed connections per user */
  maxConnectionsPerUser: number;
  
  /** Memory usage stats */
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
  
  /** Server uptime in seconds */
  uptime: number;
  
  /** Current timestamp */
  timestamp: string;
}

/**
 * Active Room Info DTO
 * 
 * Represents a single active room with its users and locks
 */
export interface ActiveRoomInfoDto {
  /** Room ID (format: {resourceType}:{resourceUuid}) */
  roomId: string;
  
  /** Resource type (e.g., 'surgery-management') */
  resourceType: string;
  
  /** Resource UUID */
  resourceId: string;
  
  /** Users currently in this room */
  connectedUsers: Array<{
    userId: string;
    username: string;
    socketId: string;
    connectedAt: string;
  }>;
  
  /** Active locks on sub-resources in this room */
  activeSubResourceLocks: Array<{
    subResourceId: string;
    lockedBy: string;
    username: string;
    lockedAt: string;
  }>;
  
  /** Total user count */
  userCount: number;
  
  /** Total lock count */
  lockCount: number;
}

/**
 * Active Rooms Response DTO
 * 
 * GET /api/admin/websocket/rooms
 */
export interface ActiveRoomsDto {
  rooms: ActiveRoomInfoDto[];
  totalRooms: number;
  totalUsers: number;
  totalLocks: number;
  timestamp: string;
}

/**
 * Connected User Info DTO
 * 
 * Represents a single connected user with their rooms and locks
 */
export interface ConnectedUserInfoDto {
  /** User ID */
  userId: string;
  
  /** Username */
  username: string;
  
  /** User's first name */
  firstName?: string;
  
  /** User's last name */
  lastName?: string;
  
  /** User's email */
  email?: string;
  
  /** Socket connections for this user */
  sockets: Array<{
    socketId: string;
    connectedAt: string;
    transport: string;
    ipAddress: string;
    userAgent: string;
  }>;
  
  /** Rooms this user is currently in */
  rooms: string[];
  
  /** Locks held by this user */
  activeLocks: Array<{
    roomId: string;
    subResourceId: string;
    lockedAt: string;
  }>;
  
  /** Total socket connections */
  connectionCount: number;
}

/**
 * Connected Users Response DTO
 * 
 * GET /api/admin/websocket/users
 */
export interface ConnectedUsersDto {
  users: ConnectedUserInfoDto[];
  totalUsers: number;
  totalConnections: number;
  timestamp: string;
}

// ============================================================================
// ACTIVITY TRACKING & LOCK TTL DTOs (Area 9 - Task 9.2)
// ============================================================================

/**
 * Heartbeat DTO
 * 
 * Client → Server event: user:heartbeat
 * 
 * Sent by client every 60s to track user activity
 */
export interface HeartbeatDto {
  /** Timestamp of last user activity (mouse/keyboard/scroll) */
  lastActivity: number;
}

/**
 * Lock Expiring Soon DTO
 * 
 * Server → Client event: lock:expiring_soon
 * 
 * Warning sent 15 minutes before lock expires due to inactivity
 * 
 * Area 7.4: Lock Timeout & Warning
 */
export interface LockExpiringSoonDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier (tab ID, section ID, etc.) */
  subResourceId: string;
  
  /** Milliseconds remaining before lock expires (e.g., 900000 = 15 min) */
  remainingTime?: number;
  
  /** Minutes remaining (convenience field, e.g., 15) */
  remainingMinutes: number;
  
  /** Timestamp when lock will expire */
  expiresAt: number;
}

/**
 * Lock Extend DTO
 * 
 * Client → Server event: lock:extend
 * 
 * Client requests to extend lock TTL (reset timer)
 * 
 * Area 7.4: Lock Timeout & Warning
 */
export interface LockExtendDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
}

/**
 * Lock Extended Response DTO
 * 
 * Server → Client event: lock:extended
 * 
 * Confirmation that lock was successfully extended
 * 
 * Area 7.4: Lock Timeout & Warning
 */
export interface LockExtendedDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** New expiry timestamp (3h from now) */
  newExpiresAt: number;
}

/**
 * Lock Expired DTO
 * 
 * Server → Client event: lock:expired
 * 
 * Notification that user's lock was released due to timeout/inactivity
 * 
 * Area 7.4: Lock Timeout & Warning
 */
export interface LockExpiredDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Reason for lock expiration */
  reason: 'timeout' | 'INACTIVITY_TIMEOUT';
}

/**
 * Lock Released DTO
 * 
 * Server → Room broadcast event: lock:released
 * 
 * Notification to all room members that a lock was released
 */
export interface LockReleasedDto {
  /** User ID whose lock was released */
  userId: string;
  
  /** Username whose lock was released */
  username: string;
  
  /** Reason for lock release */
  reason: 'INACTIVITY_TIMEOUT' | 'EXPLICIT_RELEASE' | 'DISCONNECT';
  
  /** Room ID where lock was released */
  roomId?: string;
  
  /** Sub-resource ID that was locked (if applicable) */
  subResourceId?: string;
}

// ============================================================================
// Area 7.5: Lock Force Request DTOs
// ============================================================================

/**
 * Force Request DTO
 * 
 * Client → Server event: resource:subresource_lock:force_request
 * 
 * Request to force release a lock held by another user
 * Triggers approval/rejection flow with lock owner
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceRequestDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Optional message to lock owner explaining urgency */
  message?: string;
}

/**
 * Force Request Received DTO
 * 
 * Server → Owner event: resource:subresource_lock:force_request_received
 * 
 * Notification to lock owner that someone is requesting force release
 * Owner must respond within timeout (30s) or request auto-rejects
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceRequestReceivedDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Unique request ID for tracking */
  requestId: string;
  
  /** User requesting force release */
  requestedBy: {
    userId: string;
    username: string;
  };
  
  /** Optional message from requester */
  message?: string;
  
  /** Timeout in seconds (default: 30) */
  timeoutSeconds: number;
  
  /** When request expires (timestamp) */
  expiresAt: number;
}

/**
 * Force Request Pending DTO
 * 
 * Server → Requester event: resource:subresource_lock:force_request_pending
 * 
 * Confirmation to requester that force request was sent to owner
 * Requester waits for owner's response or timeout
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceRequestPendingDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Unique request ID for tracking */
  requestId: string;
  
  /** Current lock owner */
  lockedBy: {
    userId: string;
    username: string;
  };
  
  /** Timeout in seconds (default: 30) */
  timeoutSeconds: number;
  
  /** When request expires (timestamp) */
  expiresAt: number;
}

/**
 * Force Response DTO
 * 
 * Client → Server event: resource:subresource_lock:force_response
 * 
 * Owner's response to force request (approve or reject)
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceResponseDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Request ID being responded to */
  requestId: string;
  
  /** Whether owner approves force release */
  approved: boolean;
  
  /** Optional message to requester */
  message?: string;
}

/**
 * Force Request Approved DTO
 * 
 * Server → Requester event: resource:subresource_lock:force_request_approved
 * 
 * Notification that owner approved force request
 * Followed immediately by resource:subresource_locked event
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceRequestApprovedDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Request ID that was approved */
  requestId: string;
  
  /** Previous owner who approved */
  approvedBy: {
    userId: string;
    username: string;
  };
  
  /** Optional message from owner */
  message?: string;
}

/**
 * Force Request Rejected DTO
 * 
 * Server → Requester event: resource:subresource_lock:force_request_rejected
 * 
 * Notification that force request was rejected
 * 
 * Reasons:
 * - OWNER_REJECTED: Owner explicitly denied request
 * - TIMEOUT: Owner did not respond within 30s
 * - OWNER_DISCONNECTED: Owner disconnected before responding
 * - LOCK_RELEASED: Owner released lock before responding
 * 
 * Area 7.5: Lock Force Request
 */
export interface ForceRequestRejectedDto {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Sub-resource identifier */
  subResourceId: string;
  
  /** Request ID that was rejected */
  requestId: string;
  
  /** Reason for rejection */
  reason: 'OWNER_REJECTED' | 'TIMEOUT' | 'OWNER_DISCONNECTED' | 'LOCK_RELEASED';
  
  /** Optional message from owner (only if OWNER_REJECTED) */
  message?: string;
}

// ============================================================================
// ENHANCED ADMIN MONITORING DTOs (Detailed Aggregations)
// ============================================================================

/**
 * Socket Connection Detail DTO
 * 
 * Detailed information about a single WebSocket connection
 */
export interface SocketConnectionDetailDto {
  /** Socket ID */
  socketId: string;
  
  /** User ID */
  userId: string;
  
  /** Username */
  username: string;
  
  /** User's full name */
  fullName?: string;
  
  /** User's email */
  email?: string;
  
  /** Connection timestamp (ISO string) */
  connectedAt: string;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Duration in human-readable format (e.g., "2h 15m") */
  duration: string;
  
  /** Transport type (websocket/polling) */
  transport: string;
  
  /** IP address */
  ipAddress: string;
  
  /** User agent */
  userAgent: string;
  
  /** Referer URL */
  referer?: string;
  
  /** Rooms this socket is currently in */
  rooms: string[];
  
  /** Active locks held by this socket */
  activeLocks: Array<{
    roomId: string;
    subResourceId: string;
    lockedAt: string;
    durationMs: number;
  }>;
  
  /** Last activity timestamp (ISO string) */
  lastActivity?: string;
  
  /** Inactive time in milliseconds */
  inactiveMs?: number;
  
  /** Current sub-resource (tab) the user is viewing */
  currentSubResource?: string | null;
}

/**
 * Room Detail DTO
 * 
 * Detailed information about a single room (resource)
 */
export interface RoomDetailDto {
  /** Room ID (format: resourceType:resourceUuid) */
  roomId: string;
  
  /** Resource type (e.g., 'surgery-management') */
  resourceType: string;
  
  /** Resource UUID */
  resourceUuid: string;
  
  /** Room created at (first user joined) */
  createdAt: string;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Duration in human-readable format */
  duration: string;
  
  /** Connected users in this room */
  users: Array<{
    userId: string;
    username: string;
    socketId: string;
    joinedAt: string;
    durationMs: number;
    duration: string;
    lastActivity?: string;
    inactiveMs?: number;
    currentSubResource?: string | null; // TAB CORRENTE dell'utente
  }>;
  
  /** Sub-resources with active locks */
  subResources: Array<{
    subResourceId: string;
    lockedBy: {
      userId: string;
      username: string;
      socketId: string;
    };
    lockedAt: string;
    durationMs: number;
    duration: string;
  }>;
  
  /** Total user count */
  userCount: number;
  
  /** Total sub-resource lock count */
  lockCount: number;
}

/**
 * User Aggregation Detail DTO
 * 
 * Detailed information about a single user across all their connections
 */
export interface UserAggregationDetailDto {
  /** User ID */
  userId: string;
  
  /** Username */
  username: string;
  
  /** User's full name */
  fullName?: string;
  
  /** User's email */
  email?: string;
  
  /** First connection timestamp (oldest socket) */
  firstConnectedAt: string;
  
  /** Duration since first connection (ms) */
  totalDurationMs: number;
  
  /** Duration in human-readable format */
  totalDuration: string;
  
  /** All socket connections for this user */
  connections: Array<{
    socketId: string;
    connectedAt: string;
    durationMs: number;
    duration: string;
    transport: string;
    ipAddress: string;
    referer?: string;
  }>;
  
  /** Total socket count */
  connectionCount: number;
  
  /** Rooms this user is currently in (across all sockets) */
  rooms: Array<{
    roomId: string;
    resourceType: string;
    resourceUuid: string;
    joinedAt: string;
    durationMs: number;
    duration: string;
    socketIds: string[]; // Which sockets are in this room
  }>;
  
  /** Total room count */
  roomCount: number;
  
  /** Active locks held by this user (across all sockets) */
  locks: Array<{
    roomId: string;
    subResourceId: string;
    lockedAt: string;
    durationMs: number;
    duration: string;
    socketId: string;
  }>;
  
  /** Total lock count */
  lockCount: number;
}

/**
 * Admin Overview Response DTO
 * 
 * GET /api/admin-socket/overview
 * 
 * Master endpoint with all aggregations
 */
export interface AdminOverviewDto {
  /** Timestamp of this snapshot */
  timestamp: string;
  
  /** Summary statistics */
  summary: {
    totalSockets: number;
    totalUsers: number;
    totalRooms: number;
    totalLocks: number;
    avgSocketsPerUser: number;
    avgUsersPerRoom: number;
  };
  
  /** Sockets aggregation (detailed socket list) */
  sockets: SocketConnectionDetailDto[];
  
  /** Rooms aggregation (detailed room list) */
  rooms: RoomDetailDto[];
  
  /** Users aggregation (detailed user list) */
  users: UserAggregationDetailDto[];
}

/**
 * Sockets Aggregation Response DTO
 * 
 * GET /api/admin-socket/aggregations/sockets
 * 
 * Detailed list of all socket connections
 */
export interface SocketsAggregationDto {
  sockets: SocketConnectionDetailDto[];
  totalSockets: number;
  timestamp: string;
}

/**
 * Rooms Aggregation Response DTO
 * 
 * GET /api/admin-socket/aggregations/rooms
 * 
 * Detailed list of all active rooms
 */
export interface RoomsAggregationDto {
  rooms: RoomDetailDto[];
  totalRooms: number;
  timestamp: string;
}

/**
 * Users Aggregation Response DTO
 * 
 * GET /api/admin-socket/aggregations/users
 * 
 * Detailed list of all connected users
 */
export interface UsersAggregationDto {
  users: UserAggregationDetailDto[];
  totalUsers: number;
  timestamp: string;
}

