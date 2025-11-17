/**
 * Presence Tracking DTOs
 *
 * BE-001.2: User Presence and Resource Rooms
 * Epic: EPIC-001-websocket-gateway.md
 *
 * Architecture:
 * - Resource rooms: Socket.IO rooms for collaboration spaces (e.g., "resource:page:/patient/123")
 * - Presence tracking: In-memory Map of users per resource
 * - Real-time updates: Broadcast USER_JOINED/USER_LEFT events to room members
 *
 * @see docs/project/EPIC-001-websocket-gateway.md - BE-001.2
 */

/**
 * Resource User
 *
 * Represents a user in a resource room (internal data structure)
 */
export interface ResourceUser {
  /** User ID (from JWT) */
  userId: string;

  /** Username (from JWT) */
  username: string;

  /** User email (from JWT) */
  email?: string;

  /** Socket ID for this connection */
  socketId: string;

  /** Timestamp when user joined resource (ISO 8601) */
  joinedAt: string;

  /** Collaboration mode: editor (can modify) or viewer (read-only) */
  mode: 'editor' | 'viewer';

  /** Last activity timestamp (for stale detection) */
  lastActivityAt: string;
}

/**
 * Join Resource Request DTO
 *
 * Client → Server event: resource:join
 *
 * Example resourceId formats:
 * - page:/patient/12345 (patient record page)
 * - document:surgical-report-abc123 (document collaboration)
 * - form:consent-xyz789 (form filling)
 */
export interface JoinResourceDto {
  /** Resource identifier (format: <type>:<id>) */
  resourceId: string;

  /** Resource type (for validation/logging) */
  resourceType: string;

  /** Collaboration mode */
  mode: 'editor' | 'viewer';
}

/**
 * Resource Joined Response DTO
 *
 * Server → Client event: resource:joined
 *
 * Sent to the user who just joined the resource
 */
export interface ResourceJoinedDto {
  /** Resource identifier */
  resourceId: string;

  /** User ID */
  userId: string;

  /** Success flag */
  success: boolean;

  /** Timestamp when joined (ISO 8601) */
  joinedAt: string;

  /** Current users in resource (including this user) */
  users: ResourceUserDto[];

  /** Error message (if success=false) */
  message?: string;
}

/**
 * Resource User DTO
 *
 * User information exposed in presence list (client-facing)
 */
export interface ResourceUserDto {
  /** User ID */
  userId: string;

  /** Username */
  username: string;

  /** User email */
  email?: string;

  /** Socket ID */
  socketId: string;

  /** Timestamp when joined (ISO 8601) */
  joinedAt: string;

  /** Collaboration mode */
  mode: 'editor' | 'viewer';
}

/**
 * User Joined Resource Notification DTO
 *
 * Server → Client event: user:joined
 *
 * Broadcast to ALL OTHER users in the resource when someone joins
 */
export interface UserJoinedDto {
  /** Resource identifier */
  resourceId: string;

  /** User ID who joined */
  userId: string;

  /** Username */
  username: string;

  /** User email */
  email?: string;

  /** Socket ID */
  socketId: string;

  /** Timestamp when joined (ISO 8601) */
  joinedAt: string;

  /** Collaboration mode */
  mode: 'editor' | 'viewer';
}

/**
 * Leave Resource Request DTO
 *
 * Client → Server event: resource:leave
 */
export interface LeaveResourceDto {
  /** Resource identifier to leave */
  resourceId: string;
}

/**
 * Resource Left Response DTO
 *
 * Server → Client event: resource:left
 *
 * Sent to the user who just left the resource
 */
export interface ResourceLeftDto {
  /** Resource identifier */
  resourceId: string;

  /** User ID */
  userId: string;

  /** Success flag */
  success: boolean;

  /** Error message (if success=false) */
  message?: string;
}

/**
 * User Left Resource Notification DTO
 *
 * Server → Client event: user:left
 *
 * Broadcast to ALL OTHER users in the resource when someone leaves
 */
export interface UserLeftDto {
  /** Resource identifier */
  resourceId: string;

  /** User ID who left */
  userId: string;

  /** Username */
  username: string;

  /** Reason for leaving */
  reason: 'manual' | 'disconnect' | 'timeout';
}

/**
 * Get Resource Users Request DTO
 *
 * Client → Server event: resource:get_users
 *
 * Request current presence list for a resource
 */
export interface GetResourceUsersDto {
  /** Resource identifier */
  resourceId: string;
}

/**
 * Resource Users Response DTO
 *
 * Server → Client event: resource:users
 *
 * Response with current presence list
 */
export interface ResourceUsersDto {
  /** Resource identifier */
  resourceId: string;

  /** List of users in resource */
  users: ResourceUserDto[];

  /** Total user count */
  count: number;
}

/**
 * Sub-Resource User Group
 *
 * Groups users by sub-resource (e.g., tab)
 */
export interface SubResourceUsers {
  /** Sub-resource ID (e.g., "document:123/tab:patient-info") */
  subResourceId: string;

  /** Users in this sub-resource */
  users: ResourceUserDto[];
}

/**
 * All Users Response DTO
 *
 * Server → Client event: resource:all_users
 *
 * Sent when joining a sub-resource to show ALL users across ALL sub-resources
 * of the parent resource (e.g., all tabs of a document)
 */
export interface ResourceAllUsersDto {
  /** Parent resource ID (e.g., "document:123") */
  parentResourceId: string;

  /** Current sub-resource ID (e.g., "document:123/tab:patient-info") */
  currentSubResourceId: string;

  /** All users grouped by sub-resource */
  subResources: SubResourceUsers[];

  /** Total user count across all sub-resources */
  totalCount: number;
}
