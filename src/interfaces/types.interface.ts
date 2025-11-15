import { UserRole, ResourceType, LockStatus, PresenceStatus } from './enums';

export interface User {
  userId: string;
  username: string;
  role: UserRole;
  metadata?: Record<string, any>;
}

export interface PresenceInfo {
  userId: string;
  resourceId: string;
  status: PresenceStatus;
  role: UserRole;
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}

export interface Lock {
  lockId: string;
  resourceId: string;
  userId: string;
  acquiredAt: Date;
  expiresAt: Date;
  status: LockStatus;
  metadata?: Record<string, any>;
}

export interface Resource {
  resourceId: string;
  resourceType: ResourceType;
  parentId?: string;
  name: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReconciliationEvent {
  eventId: string;
  resourceId: string;
  userId: string;
  eventType: string;
  data: any;
  timestamp: Date;
  reconciled?: boolean;
}

export interface MonitoringMetrics {
  totalUsers: number;
  totalResources: number;
  totalLocks: number;
  activeConnections: number;
  timestamp: Date;
}
