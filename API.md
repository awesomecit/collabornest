# CollaborNest API Reference

Complete API reference for all services and interfaces.

## Table of Contents

- [Services](#services)
  - [PresenceService](#presenceservice)
  - [LockingService](#lockingservice)
  - [RolesService](#rolesservice)
  - [ResourceService](#resourceservice)
  - [ReconciliationService](#reconciliationservice)
  - [MonitoringService](#monitoringservice)
- [WebSocket Gateway](#websocket-gateway)
- [Interfaces](#interfaces)
- [Enums](#enums)

## Services

### PresenceService

Manages user presence in resources.

#### Methods

##### `joinResource(userId, resourceId, role, metadata?)`

Register a user's presence in a resource.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier
- `role` (UserRole): User role (EDITOR or VIEWER)
- `metadata?` (object): Optional metadata

**Returns:** `Promise<PresenceInfo>`

**Example:**
```typescript
const presence = await presenceService.joinResource(
  'user-123',
  'resource-456',
  UserRole.EDITOR,
  { name: 'John Doe' }
);
```

##### `leaveResource(userId, resourceId)`

Remove a user's presence from a resource.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<void>`

##### `updateHeartbeat(userId, resourceId)`

Update user's heartbeat timestamp.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<void>`

##### `getPresence(userId, resourceId)`

Get presence info for a specific user in a resource.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<PresenceInfo | null>`

##### `getResourcePresence(resourceId)`

Get all users present in a resource.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<PresenceInfo[]>`

##### `updateStatus(userId, resourceId, status)`

Update user's status.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier
- `status` (PresenceStatus): New status

**Returns:** `Promise<void>`

---

### LockingService

Manages resource locking.

#### Methods

##### `acquireLock(resourceId, userId, timeout?, metadata?)`

Acquire a lock on a resource.

**Parameters:**
- `resourceId` (string): Resource identifier
- `userId` (string): User identifier
- `timeout?` (number): Lock timeout in milliseconds
- `metadata?` (object): Optional metadata

**Returns:** `Promise<Lock | null>` - Returns lock if acquired, null if already locked

**Example:**
```typescript
const lock = await lockingService.acquireLock(
  'resource-456',
  'user-123',
  300000 // 5 minutes
);
```

##### `releaseLock(resourceId, userId)`

Release a lock.

**Parameters:**
- `resourceId` (string): Resource identifier
- `userId` (string): User identifier (must be lock owner)

**Returns:** `Promise<boolean>` - true if released, false otherwise

##### `getLock(resourceId)`

Get current lock status.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<Lock | null>`

##### `renewLock(resourceId, userId, timeout?)`

Renew an existing lock.

**Parameters:**
- `resourceId` (string): Resource identifier
- `userId` (string): User identifier (must be lock owner)
- `timeout?` (number): New timeout in milliseconds

**Returns:** `Promise<Lock | null>`

##### `isLocked(resourceId)`

Check if resource is locked.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<boolean>`

##### `isLockedByUser(resourceId, userId)`

Check if resource is locked by a specific user.

**Parameters:**
- `resourceId` (string): Resource identifier
- `userId` (string): User identifier

**Returns:** `Promise<boolean>`

---

### RolesService

Manages user roles.

#### Methods

##### `assignRole(userId, resourceId, role)`

Assign a role to a user for a resource.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier
- `role` (UserRole): Role to assign

**Returns:** `Promise<void>`

##### `getRole(userId, resourceId)`

Get user's role for a resource.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<UserRole | null>`

##### `removeRole(userId, resourceId)`

Remove user's role.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<void>`

##### `isEditor(userId, resourceId)`

Check if user is an editor.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<boolean>`

##### `isViewer(userId, resourceId)`

Check if user is a viewer.

**Parameters:**
- `userId` (string): User identifier
- `resourceId` (string): Resource identifier

**Returns:** `Promise<boolean>`

##### `getEditors(resourceId)`

Get all editors for a resource.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<string[]>` - Array of user IDs

##### `getViewers(resourceId)`

Get all viewers for a resource.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<string[]>` - Array of user IDs

---

### ResourceService

Manages hierarchical resources.

#### Methods

##### `createResource(name, resourceType, parentId?, metadata?)`

Create a new resource.

**Parameters:**
- `name` (string): Resource name
- `resourceType` (ResourceType): ROOT or CHILD
- `parentId?` (string): Parent resource ID (required for CHILD)
- `metadata?` (object): Optional metadata

**Returns:** `Promise<Resource>`

**Example:**
```typescript
// Create root resource
const patient = await resourceService.createResource(
  'Patient-001',
  ResourceType.ROOT
);

// Create child resource
const visit = await resourceService.createResource(
  'Visit-2024-01',
  ResourceType.CHILD,
  patient.resourceId
);
```

##### `getResource(resourceId)`

Get resource by ID.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<Resource | null>`

##### `updateResource(resourceId, updates)`

Update resource.

**Parameters:**
- `resourceId` (string): Resource identifier
- `updates` (object): Fields to update

**Returns:** `Promise<Resource | null>`

##### `deleteResource(resourceId)`

Delete resource and all children.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<boolean>`

##### `getChildren(resourceId)`

Get child resources.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<Resource[]>`

##### `getParent(resourceId)`

Get parent resource.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<Resource | null>`

##### `getAllResources()`

Get all resources.

**Returns:** `Promise<Resource[]>`

##### `getRootResources()`

Get all root resources.

**Returns:** `Promise<Resource[]>`

---

### ReconciliationService

Manages event reconciliation.

#### Methods

##### `publishEvent(resourceId, userId, eventType, data)`

Publish an event.

**Parameters:**
- `resourceId` (string): Resource identifier
- `userId` (string): User identifier
- `eventType` (string): Event type
- `data` (any): Event data

**Returns:** `Promise<ReconciliationEvent>`

**Example:**
```typescript
await reconciliationService.publishEvent(
  'resource-456',
  'user-123',
  'data.updated',
  { field: 'title', value: 'New Title' }
);
```

##### `getEvents(resourceId)`

Get all events for a resource.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<ReconciliationEvent[]>`

##### `markAsReconciled(eventId)`

Mark event as reconciled.

**Parameters:**
- `eventId` (string): Event identifier

**Returns:** `Promise<void>`

##### `getUnreconciledEvents(resourceId)`

Get unreconciled events.

**Parameters:**
- `resourceId` (string): Resource identifier

**Returns:** `Promise<ReconciliationEvent[]>`

---

### MonitoringService

Collects system metrics.

#### Methods

##### `collectMetrics()`

Collect current metrics.

**Returns:** `Promise<MonitoringMetrics>`

##### `getMetrics()`

Get latest metrics.

**Returns:** `Promise<MonitoringMetrics>`

##### `getMetricsHistory(hours?)`

Get historical metrics.

**Parameters:**
- `hours?` (number): Number of hours to retrieve (default: 1)

**Returns:** `Promise<MonitoringMetrics[]>`

---

## WebSocket Gateway

### Events to Emit

#### `joinResource`

Join a resource.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
  role: UserRole;
  metadata?: object;
}
```

**Response:**
```typescript
{
  success: boolean;
  presence: PresenceInfo;
  allUsers: PresenceInfo[];
}
```

#### `leaveResource`

Leave a resource.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
}
```

#### `heartbeat`

Send heartbeat.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
}
```

#### `updateStatus`

Update status.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
  status: PresenceStatus;
}
```

#### `acquireLock`

Acquire lock.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
  timeout?: number;
}
```

#### `releaseLock`

Release lock.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
}
```

#### `publishEvent`

Publish event.

**Payload:**
```typescript
{
  userId: string;
  resourceId: string;
  eventType: string;
  data: any;
}
```

### Events to Listen

#### `userJoined`

Emitted when a user joins.

**Data:** `PresenceInfo`

#### `userLeft`

Emitted when a user leaves.

**Data:**
```typescript
{
  userId: string;
  resourceId: string;
}
```

#### `statusChanged`

Emitted when status changes.

**Data:**
```typescript
{
  userId: string;
  status: PresenceStatus;
}
```

#### `lockAcquired`

Emitted when lock is acquired.

**Data:** `Lock`

#### `lockReleased`

Emitted when lock is released.

**Data:**
```typescript
{
  resourceId: string;
  userId: string;
}
```

#### `eventPublished`

Emitted when event is published.

**Data:** `ReconciliationEvent`

---

## Interfaces

### PresenceInfo

```typescript
interface PresenceInfo {
  userId: string;
  resourceId: string;
  status: PresenceStatus;
  role: UserRole;
  connectedAt: Date;
  lastHeartbeat: Date;
  metadata?: Record<string, any>;
}
```

### Lock

```typescript
interface Lock {
  lockId: string;
  resourceId: string;
  userId: string;
  acquiredAt: Date;
  expiresAt: Date;
  status: LockStatus;
  metadata?: Record<string, any>;
}
```

### Resource

```typescript
interface Resource {
  resourceId: string;
  resourceType: ResourceType;
  parentId?: string;
  name: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### ReconciliationEvent

```typescript
interface ReconciliationEvent {
  eventId: string;
  resourceId: string;
  userId: string;
  eventType: string;
  data: any;
  timestamp: Date;
  reconciled?: boolean;
}
```

### MonitoringMetrics

```typescript
interface MonitoringMetrics {
  totalUsers: number;
  totalResources: number;
  totalLocks: number;
  activeConnections: number;
  timestamp: Date;
}
```

---

## Enums

### UserRole

```typescript
enum UserRole {
  EDITOR = 'editor',
  VIEWER = 'viewer',
}
```

### ResourceType

```typescript
enum ResourceType {
  ROOT = 'root',
  CHILD = 'child',
}
```

### LockStatus

```typescript
enum LockStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
}
```

### PresenceStatus

```typescript
enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}
```
