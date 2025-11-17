/**
 * Resource Configuration Types
 *
 * Defines semantic, type-safe configuration for resources and sub-resources
 * with concurrency limits, role-based access, and state constraints.
 *
 * @see EPIC-004: Resource Configuration Management
 */

/**
 * Resource types supported by the gateway
 */
export enum ResourceType {
  /** Surgical operation document */
  SURGERY = 'surgery',

  /** Patient medical record */
  PATIENT = 'patient',

  /** Clinical report/documentation */
  REPORT = 'report',

  /** Generic document */
  DOCUMENT = 'document',
}

/**
 * Sub-resource types (sections within a resource)
 */
export enum SubResourceType {
  /** Main content/body */
  MAIN = 'main',

  /** Metadata section */
  METADATA = 'metadata',

  /** Attachments/files */
  ATTACHMENTS = 'attachments',

  /** Comments/annotations */
  COMMENTS = 'comments',

  /** Audit log */
  AUDIT = 'audit',
}

/**
 * User roles for access control
 */
export enum UserRole {
  /** System administrator */
  ADMIN = 'admin',

  /** Surgeon/physician */
  SURGEON = 'surgeon',

  /** Anesthesiologist */
  ANESTHESIOLOGIST = 'anesthesiologist',

  /** Nurse */
  NURSE = 'nurse',

  /** Viewer (read-only) */
  VIEWER = 'viewer',

  /** Guest (limited access) */
  GUEST = 'guest',
}

/**
 * Resource state (lifecycle)
 */
export enum ResourceState {
  /** Draft - editable by anyone with permission */
  DRAFT = 'draft',

  /** In progress - actively being edited */
  IN_PROGRESS = 'in_progress',

  /** Under review - read-only for most users */
  UNDER_REVIEW = 'under_review',

  /** Approved - locked, only admins can edit */
  APPROVED = 'approved',

  /** Archived - read-only for all */
  ARCHIVED = 'archived',

  /** Deleted (soft delete) */
  DELETED = 'deleted',
}

/**
 * State transition rule
 * Defines allowed state changes and role constraints
 */
export interface StateTransition {
  /** Source state */
  from: ResourceState;

  /** Target state */
  to: ResourceState;

  /**
   * Roles allowed to perform this transition
   * - Empty array [] = public access (any authenticated user)
   * - Non-empty array = restricted to specified roles
   */
  allowedRoles: UserRole[];

  /** Requires lock release before transition */
  requiresUnlock?: boolean;

  /** Custom validation rules (e.g., "all signatures present") */
  validationRules?: string[];
}

/**
 * Concurrency limit configuration
 */
export interface ConcurrencyLimit {
  /** Maximum concurrent editors (0 = unlimited) */
  maxEditors: number;

  /** Maximum concurrent viewers (0 = unlimited) */
  maxViewers: number;

  /** Role-specific overrides */
  roleOverrides?: Partial<Record<UserRole, number>>;
}

/**
 * Sub-resource configuration
 */
export interface SubResourceConfig {
  /** Sub-resource type */
  type: SubResourceType;

  /** Display name */
  displayName: string;

  /** Concurrency limits */
  concurrency: ConcurrencyLimit;

  /**
   * Roles allowed to edit
   * - Empty array [] = public edit (any authenticated user)
   * - Non-empty array = restricted to specified roles
   */
  editRoles: UserRole[];

  /**
   * Roles allowed to view
   * - Empty array [] = public view (any authenticated user)
   * - Non-empty array = restricted to specified roles
   */
  viewRoles: UserRole[];

  /** Lock required for editing */
  requiresLock: boolean;

  /** Independent locking (can lock sub-resource without parent) */
  independentLock?: boolean;
}

/**
 * Resource configuration
 */
export interface ResourceConfig {
  /** Resource type */
  type: ResourceType;

  /** Display name */
  displayName: string;

  /** Concurrency limits for entire resource */
  concurrency: ConcurrencyLimit;

  /** Sub-resources configuration */
  subResources: SubResourceConfig[];

  /** State transition rules */
  stateTransitions: StateTransition[];

  /** States that block editing (require unlock first) */
  lockedStates: ResourceState[];

  /** Lock TTL in milliseconds (default: 5 minutes) */
  lockTTL?: number;

  /** Heartbeat interval in milliseconds (default: 60s) */
  heartbeatInterval?: number;
}

/**
 * Complete resource configuration map
 */
export type ResourceConfigMap = Record<ResourceType, ResourceConfig>;

/**
 * Example configuration for surgical operations
 */
export const SURGERY_CONFIG: ResourceConfig = {
  type: ResourceType.SURGERY,
  displayName: 'Surgical Operation',
  concurrency: {
    maxEditors: 1, // Single editor (meeting decision)
    maxViewers: 0, // Unlimited viewers
  },
  subResources: [
    {
      type: SubResourceType.MAIN,
      displayName: 'Operation Details',
      concurrency: {
        maxEditors: 1,
        maxViewers: 0,
      },
      editRoles: [UserRole.ADMIN, UserRole.SURGEON],
      viewRoles: [
        UserRole.ADMIN,
        UserRole.SURGEON,
        UserRole.NURSE,
        UserRole.VIEWER,
      ],
      requiresLock: true,
      independentLock: false, // Must lock entire surgery
    },
    {
      type: SubResourceType.METADATA,
      displayName: 'Metadata',
      concurrency: {
        maxEditors: 1,
        maxViewers: 0,
      },
      editRoles: [UserRole.ADMIN],
      viewRoles: [UserRole.ADMIN, UserRole.SURGEON, UserRole.NURSE],
      requiresLock: true,
    },
    {
      type: SubResourceType.COMMENTS,
      displayName: 'Comments',
      concurrency: {
        maxEditors: 0, // Multiple simultaneous comments
        maxViewers: 0,
      },
      editRoles: [UserRole.ADMIN, UserRole.SURGEON, UserRole.NURSE],
      viewRoles: [
        UserRole.ADMIN,
        UserRole.SURGEON,
        UserRole.NURSE,
        UserRole.VIEWER,
      ],
      requiresLock: false, // No lock needed for comments
      independentLock: true,
    },
  ],
  stateTransitions: [
    {
      from: ResourceState.DRAFT,
      to: ResourceState.IN_PROGRESS,
      allowedRoles: [UserRole.ADMIN, UserRole.SURGEON],
    },
    {
      from: ResourceState.IN_PROGRESS,
      to: ResourceState.UNDER_REVIEW,
      allowedRoles: [UserRole.ADMIN, UserRole.SURGEON],
      requiresUnlock: true, // Must release lock first
    },
    {
      from: ResourceState.UNDER_REVIEW,
      to: ResourceState.APPROVED,
      allowedRoles: [UserRole.ADMIN],
    },
    {
      from: ResourceState.APPROVED,
      to: ResourceState.ARCHIVED,
      allowedRoles: [UserRole.ADMIN],
    },
  ],
  lockedStates: [
    ResourceState.APPROVED,
    ResourceState.ARCHIVED,
    ResourceState.DELETED,
  ],
  lockTTL: 5 * 60 * 1000, // 5 minutes (meeting decision)
  heartbeatInterval: 60 * 1000, // 60 seconds (meeting decision)
};
