/**
 * Domain types for WebSocket Gateway resource management
 *
 * NOMENCLATURE:
 * - Resource: Domain entity being collaborated on (e.g., patient record, surgery plan)
 * - Room: Socket.IO communication channel (roomId often equals resourceId)
 * - SubResource: Child resource with 1-level hierarchy (root → child only)
 *
 * Examples:
 * - Root resource: "surgery-management:abc-123"
 * - Sub-resource: "surgery-management:abc-123/field:anesthesia-notes"
 * - Room ID: Same as resourceId for direct mapping
 */

/**
 * Resource type enumeration
 * Maps to WEBSOCKET_ROOM_LIMIT_<TYPE> environment variables
 */
export enum ResourceType {
  /** Surgery management dashboard */
  RESOURCE = 'resource',
  /** Administrative resource (higher limits) */
  ADMIN = 'admin',
  /** Chat/messaging resource */
  CHAT = 'chat',
  /** Patient record resource */
  PATIENT_RECORD = 'patient_record',
  /** Clinical document resource */
  CLINICAL_DOCUMENT = 'clinical_document',
}

/**
 * User role within a resource
 */
export enum ResourceRole {
  /** Can view content only */
  VIEWER = 'viewer',
  /** Can edit content */
  EDITOR = 'editor',
  /** Can edit and manage permissions */
  ADMIN = 'admin',
}

/**
 * Resource identifier with type prefix
 * Format: "resourceType:identifier" or "resourceType:identifier/subResourceType:subIdentifier"
 *
 * Examples:
 * - "surgery-management:abc-123"
 * - "patient_record:12345"
 * - "surgery-management:abc-123/field:anesthesia-notes" (sub-resource)
 */
export interface ResourceId {
  /** Full resource identifier (e.g., "surgery-management:abc-123") */
  readonly id: string;
  /** Resource type (e.g., "surgery-management") */
  readonly type: string;
  /** Resource-specific identifier (e.g., "abc-123") */
  readonly identifier: string;
  /** Parent resource ID if this is a sub-resource */
  readonly parentId?: string;
  /** Sub-resource type if this is a sub-resource (e.g., "field") */
  readonly subType?: string;
  /** Sub-resource identifier if this is a sub-resource (e.g., "anesthesia-notes") */
  readonly subIdentifier?: string;
}

/**
 * Room identifier (Socket.IO channel)
 * In most cases, roomId === resourceId for direct mapping
 */
export type RoomId = string;

/**
 * Parse resource ID string into structured format
 *
 * @param resourceIdString - Resource ID in format "type:id" or "type:id/subType:subId"
 * @returns Parsed ResourceId object
 * @throws Error if format is invalid
 *
 * @example
 * parseResourceId("surgery-management:abc-123")
 * // => { id: "surgery-management:abc-123", type: "surgery-management", identifier: "abc-123" }
 *
 * @example
 * parseResourceId("surgery-management:abc-123/field:anesthesia-notes")
 * // => {
 * //   id: "surgery-management:abc-123/field:anesthesia-notes",
 * //   type: "surgery-management",
 * //   identifier: "abc-123",
 * //   parentId: "surgery-management:abc-123",
 * //   subType: "field",
 * //   subIdentifier: "anesthesia-notes"
 * // }
 *
 * @example
 * parseResourceId("page:/patient/12345")
 * // => { id: "page:/patient/12345", type: "page", identifier: "/patient/12345" }
 */
export function parseResourceId(resourceIdString: string): ResourceId {
  // Check for sub-resource format: "type:id/subType:subId"
  // Must have format where the part after "/" contains ":"
  const mainMatch = resourceIdString.match(/^([^:]+):(.+)$/);

  if (!mainMatch) {
    throw new Error(
      `Invalid resource ID format: "${resourceIdString}". Expected "type:id" or "type:id/subType:subId"`,
    );
  }

  const [, type, remainder] = mainMatch;

  // Look for sub-resource pattern in remainder
  // Find the LAST occurrence of "/subType:" pattern
  const lastSlashColonMatch = remainder.match(/^(.+)\/([^/:]+):([^/]+)$/);

  if (lastSlashColonMatch) {
    const [, identifier, subType, subIdentifier] = lastSlashColonMatch;
    const parentId = `${type}:${identifier}`;

    return {
      id: resourceIdString,
      type,
      identifier,
      parentId,
      subType,
      subIdentifier,
    };
  }

  // Standard format: "type:id" (identifier may contain "/")
  return {
    id: resourceIdString,
    type,
    identifier: remainder,
  };
}

/**
 * Build resource ID string from components
 *
 * @param type - Resource type (e.g., "surgery-management")
 * @param identifier - Resource identifier (e.g., "abc-123")
 * @param subType - Optional sub-resource type (e.g., "field")
 * @param subIdentifier - Optional sub-resource identifier (e.g., "anesthesia-notes")
 * @returns Formatted resource ID string
 *
 * @example
 * buildResourceId("surgery-management", "abc-123")
 * // => "surgery-management:abc-123"
 *
 * @example
 * buildResourceId("surgery-management", "abc-123", "field", "anesthesia-notes")
 * // => "surgery-management:abc-123/field:anesthesia-notes"
 */
export function buildResourceId(
  type: string,
  identifier: string,
  subType?: string,
  subIdentifier?: string,
): string {
  const baseId = `${type}:${identifier}`;

  if (subType && subIdentifier) {
    return `${baseId}/${subType}:${subIdentifier}`;
  }

  return baseId;
}

/**
 * Check if resource ID represents a sub-resource
 *
 * @param resourceIdString - Resource ID string
 * @returns True if resource is a sub-resource
 *
 * @example
 * isSubResource("surgery-management:abc-123") // => false
 * isSubResource("surgery-management:abc-123/field:anesthesia-notes") // => true
 * isSubResource("page:/patient/12345") // => false (path separator, not sub-resource)
 */
export function isSubResource(resourceIdString: string): boolean {
  // Sub-resource format: "type:id/subType:subId"
  // Must contain "/" AND the part after "/" must contain ":"
  const slashIndex = resourceIdString.indexOf('/');
  if (slashIndex === -1) {
    return false;
  }

  // Extract part after the first "/"
  const afterSlash = resourceIdString.substring(slashIndex + 1);

  // Check if it contains ":" (sub-resource marker)
  return afterSlash.includes(':');
}

/**
 * Extract parent resource ID from sub-resource ID
 *
 * @param resourceIdString - Sub-resource ID string
 * @returns Parent resource ID or null if not a sub-resource
 *
 * @example
 * getParentResourceId("surgery-management:abc-123/field:anesthesia-notes")
 * // => "surgery-management:abc-123"
 *
 * @example
 * getParentResourceId("surgery-management:abc-123")
 * // => null
 */
export function getParentResourceId(resourceIdString: string): string | null {
  if (!isSubResource(resourceIdString)) {
    return null;
  }

  const parsed = parseResourceId(resourceIdString);
  return parsed.parentId || null;
}

/**
 * User metadata within a resource/room
 */
export interface ResourceUser {
  /** User ID from JWT claims */
  readonly userId: string;
  /** User display name */
  readonly username: string;
  /** User role within this resource */
  readonly role: ResourceRole;
  /** Timestamp when user joined (ISO 8601) */
  readonly joinedAt: string;
  /** Socket ID for this connection */
  readonly socketId: string;
  /** User email (optional) */
  readonly email?: string;
}

/**
 * Resource state snapshot
 * Sent to users when they join a resource
 */
export interface ResourceState {
  /** Resource identifier */
  readonly resourceId: string;
  /** List of currently online users */
  readonly users: ResourceUser[];
  /** Current Y.js document state (base64-encoded) */
  readonly yjsState?: string;
  /** Current document revision number */
  readonly revision: number;
  /** Active locks on this resource */
  readonly locks: ResourceLock[];
}

/**
 * Lock on a resource or sub-resource
 */
export interface ResourceLock {
  /** Lock identifier */
  readonly lockId: string;
  /** Resource being locked */
  readonly resourceId: string;
  /** User holding the lock */
  readonly userId: string;
  /** Lock type */
  readonly lockType: 'exclusive' | 'shared';
  /** Timestamp when lock was acquired (ISO 8601) */
  readonly acquiredAt: string;
  /** Timestamp when lock expires (ISO 8601) */
  readonly expiresAt: string;
}
