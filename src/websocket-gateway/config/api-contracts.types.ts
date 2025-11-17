/**
 * API Producer/Consumer Contracts
 *
 * Standard interface for API consumers (UI) and producers (backend services)
 * to communicate resource state changes, lock events, and validation results.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { ResourceState, ResourceType, UserRole } from './resource-config.types';

/**
 * Transport protocol for events
 */
export enum TransportProtocol {
  /** WebSocket (real-time) */
  WEBSOCKET = 'websocket',

  /** HTTP (REST) */
  HTTP = 'http',

  /** Server-Sent Events (SSE) */
  SSE = 'sse',

  /** Message Queue (RabbitMQ, Kafka) */
  MESSAGE_QUEUE = 'message_queue',
}

/**
 * Event severity level
 */
export enum EventSeverity {
  /** Informational */
  INFO = 'info',

  /** Warning (non-blocking) */
  WARNING = 'warning',

  /** Error (blocking) */
  ERROR = 'error',

  /** Critical (system failure) */
  CRITICAL = 'critical',
}

/**
 * Base event payload (all events extend this)
 */
export interface BaseEventPayload {
  /** Event unique ID */
  eventId: string;

  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Resource type */
  resourceType: ResourceType;

  /** Resource ID */
  resourceId: string;

  /** User who triggered event */
  userId: string;

  /** User role */
  userRole: UserRole;

  /** Event severity */
  severity: EventSeverity;

  /** Revision/version number */
  revision: number;
}

/**
 * Lock event payload
 */
export interface LockEventPayload extends BaseEventPayload {
  /** Lock action */
  action: 'acquired' | 'released' | 'denied' | 'expired' | 'renewed';

  /** Lock holder user ID (if acquired) */
  lockHolderId?: string;

  /** Lock expiration time (ISO 8601) */
  expiresAt?: string;

  /** Reason for denial (if denied) */
  denialReason?: string;
}

/**
 * State change event payload
 */
export interface StateChangeEventPayload extends BaseEventPayload {
  /** Previous state */
  previousState: ResourceState;

  /** New state */
  newState: ResourceState;

  /** New revision after state change */
  newRevision: number;

  /** State change approved */
  approved: boolean;

  /** Validation errors (if not approved) */
  validationErrors?: string[];
}

/**
 * Update event payload (resource content changed)
 */
export interface UpdateEventPayload extends BaseEventPayload {
  /** Update successful */
  success: boolean;

  /** New revision after update */
  newRevision: number;

  /** Changed fields */
  changedFields?: string[];

  /** Validation errors (if failed) */
  validationErrors?: string[];

  /** Conflict detected (concurrent edit) */
  conflict?: boolean;

  /** Conflict resolution strategy applied */
  conflictResolution?: 'overwrite' | 'merge' | 'reject';
}

/**
 * API Producer Contract (Backend → UI)
 */
export interface ApiProducerContract {
  /**
   * Endpoint to check API readiness
   * @returns Health check response
   */
  getHealthCheck(): Promise<{
    ready: boolean;
    services: Record<string, 'up' | 'down'>;
    version: string;
  }>;

  /**
   * Endpoint to get supported resources
   * @returns List of resource types and their configurations
   */
  getSupportedResources(): Promise<{
    resources: ResourceType[];
    configurations: Record<ResourceType, unknown>;
  }>;

  /**
   * Subscribe to resource events
   * @param resourceType - Resource type to subscribe
   * @param resourceId - Specific resource ID (optional, null = all)
   * @param protocol - Transport protocol
   * @returns Subscription handle
   */
  subscribeToEvents(
    resourceType: ResourceType,
    resourceId: string | null,
    protocol: TransportProtocol,
  ): Promise<{ subscriptionId: string; endpoint: string }>;

  /**
   * Unsubscribe from resource events
   * @param subscriptionId - Subscription handle
   */
  unsubscribeFromEvents(subscriptionId: string): Promise<void>;
}

/**
 * API Consumer Contract (UI → Backend)
 */
export interface ApiConsumerContract {
  /**
   * Request editor lock on resource
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param subResourceType - Sub-resource (optional)
   * @returns Lock request result
   */
  requestLock(
    resourceType: ResourceType,
    resourceId: string,
    subResourceType?: string,
  ): Promise<{
    acquired: boolean;
    lockHolderId?: string;
    expiresAt?: string;
    denialReason?: string;
  }>;

  /**
   * Release editor lock
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param subResourceType - Sub-resource (optional)
   * @returns Release result
   */
  releaseLock(
    resourceType: ResourceType,
    resourceId: string,
    subResourceType?: string,
  ): Promise<{ released: boolean }>;

  /**
   * Send heartbeat to renew lock
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @returns Renewal result
   */
  sendHeartbeat(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<{ renewed: boolean; expiresAt?: string }>;

  /**
   * Update resource content
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param revision - Current revision (optimistic locking)
   * @param changes - Changed fields
   * @returns Update result
   */
  updateResource(
    resourceType: ResourceType,
    resourceId: string,
    revision: number,
    changes: Record<string, unknown>,
  ): Promise<UpdateEventPayload>;

  /**
   * Request state transition
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   * @param targetState - Desired state
   * @returns Transition result
   */
  requestStateTransition(
    resourceType: ResourceType,
    resourceId: string,
    targetState: ResourceState,
  ): Promise<StateChangeEventPayload>;

  /**
   * Handle incoming event from producer
   * @param event - Event payload
   */
  onEvent(
    event: LockEventPayload | StateChangeEventPayload | UpdateEventPayload,
  ): void;
}

/**
 * Event routing map (which events, where, via which transport)
 */
export interface EventRoutingConfig {
  /** Event type identifier */
  eventType: 'lock' | 'state_change' | 'update' | 'error';

  /** Target endpoints */
  endpoints: {
    /** WebSocket event name */
    websocket?: string;

    /** HTTP endpoint path */
    http?: string;

    /** SSE channel name */
    sse?: string;

    /** Message queue topic */
    messageQueue?: string;
  };

  /** Broadcast to all subscribers or just affected users */
  broadcast: 'all' | 'room' | 'user';

  /** Retry policy (for failed deliveries) */
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

/**
 * Complete event routing configuration
 */
export const EVENT_ROUTING: Record<string, EventRoutingConfig> = {
  lock_acquired: {
    eventType: 'lock',
    endpoints: {
      websocket: 'LOCK_ACQUIRED', // WsEvent enum value
    },
    broadcast: 'room', // Notify all viewers in resource room
  },
  lock_released: {
    eventType: 'lock',
    endpoints: {
      websocket: 'LOCK_RELEASED',
    },
    broadcast: 'room',
  },
  lock_denied: {
    eventType: 'lock',
    endpoints: {
      websocket: 'LOCK_DENIED',
    },
    broadcast: 'user', // Only notify requesting user
  },
  state_changed: {
    eventType: 'state_change',
    endpoints: {
      websocket: 'STATE_CHANGED',
      http: '/api/resources/:resourceType/:resourceId/state',
    },
    broadcast: 'room',
  },
  resource_updated: {
    eventType: 'update',
    endpoints: {
      websocket: 'RESOURCE_UPDATED',
      http: '/api/resources/:resourceType/:resourceId',
    },
    broadcast: 'room',
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 1000,
    },
  },
};
