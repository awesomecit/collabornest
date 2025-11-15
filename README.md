# CollaborNest

Libreria open-source per aggiungere un livello collaborativo top of the app su stack Node.js/NestJS con Socket.IO, Redis e RabbitMQ.

Pensata per casi d'uso gestionali / healthcare, fornisce: presenza, locking, gestione editor/viewer, riconciliazione/monitoring, e un modello generico di risorse/root→child.

## Features

- **Presenza (Presence Management)**: Track users in real-time with heartbeat monitoring
- **Locking**: Resource locking mechanism to prevent conflicts
- **Gestione Editor/Viewer**: Role-based access control for editors and viewers
- **Riconciliazione**: Event reconciliation with RabbitMQ support
- **Monitoring**: Real-time metrics and monitoring
- **Modello Risorse**: Generic resource model with root→child hierarchy

## Installation

```bash
npm install collabornest
```

### Peer Dependencies

You'll need to install these peer dependencies:

```bash
npm install @nestjs/common @nestjs/core @nestjs/websockets socket.io ioredis amqplib
```

## Quick Start

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { CollaborNestModule } from 'collabornest';

@Module({
  imports: [
    CollaborNestModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
      rabbitmq: {
        url: 'amqp://localhost:5672',
      },
      presence: {
        heartbeatInterval: 30000,
        timeout: 60000,
      },
      locking: {
        defaultTimeout: 300000,
      },
      monitoring: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Services

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  PresenceService,
  LockingService,
  ResourceService,
  UserRole,
  ResourceType,
} from 'collabornest';

@Controller('collaboration')
export class CollaborationController {
  constructor(
    private presenceService: PresenceService,
    private lockingService: LockingService,
    private resourceService: ResourceService,
  ) {}

  @Post('join')
  async joinResource(@Body() data: { userId: string; resourceId: string }) {
    return this.presenceService.joinResource(
      data.userId,
      data.resourceId,
      UserRole.EDITOR,
    );
  }

  @Post('lock')
  async acquireLock(@Body() data: { userId: string; resourceId: string }) {
    return this.lockingService.acquireLock(data.resourceId, data.userId);
  }

  @Post('resource')
  async createResource(@Body() data: { name: string; type: ResourceType }) {
    return this.resourceService.createResource(data.name, data.type);
  }
}
```

### 3. Connect with Socket.IO Client

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Join a resource
socket.emit('joinResource', {
  userId: 'user-123',
  resourceId: 'resource-456',
  role: 'editor',
}, (response) => {
  console.log('Joined resource:', response);
});

// Listen for events
socket.on('userJoined', (data) => {
  console.log('User joined:', data);
});

socket.on('lockAcquired', (data) => {
  console.log('Lock acquired:', data);
});

// Acquire lock
socket.emit('acquireLock', {
  userId: 'user-123',
  resourceId: 'resource-456',
}, (response) => {
  console.log('Lock response:', response);
});
```

## Architecture

### Services

#### PresenceService

Manages user presence in resources:

- `joinResource()`: Register user presence
- `leaveResource()`: Remove user presence
- `updateHeartbeat()`: Update user heartbeat
- `getResourcePresence()`: Get all users in a resource
- `updateStatus()`: Update user status (online/away/offline)

#### LockingService

Manages resource locking:

- `acquireLock()`: Acquire a lock on a resource
- `releaseLock()`: Release a lock
- `getLock()`: Get current lock status
- `renewLock()`: Renew an existing lock
- `isLocked()`: Check if resource is locked

#### RolesService

Manages user roles:

- `assignRole()`: Assign a role to a user
- `getRole()`: Get user's role for a resource
- `isEditor()`: Check if user is an editor
- `isViewer()`: Check if user is a viewer

#### ResourceService

Manages hierarchical resources:

- `createResource()`: Create a new resource
- `getResource()`: Get resource details
- `updateResource()`: Update resource
- `deleteResource()`: Delete resource and children
- `getChildren()`: Get child resources
- `getParent()`: Get parent resource

#### ReconciliationService

Manages event reconciliation:

- `publishEvent()`: Publish an event
- `getEvents()`: Get all events for a resource
- `markAsReconciled()`: Mark event as reconciled
- `getUnreconciledEvents()`: Get unreconciled events

#### MonitoringService

Collects and provides metrics:

- `collectMetrics()`: Collect current metrics
- `getMetrics()`: Get latest metrics
- `getMetricsHistory()`: Get historical metrics

### WebSocket Gateway

The `CollaborationGateway` provides real-time communication:

**Events to emit:**
- `joinResource`: Join a resource
- `leaveResource`: Leave a resource
- `heartbeat`: Send heartbeat
- `updateStatus`: Update user status
- `acquireLock`: Acquire lock
- `releaseLock`: Release lock
- `publishEvent`: Publish event

**Events to listen:**
- `userJoined`: User joined resource
- `userLeft`: User left resource
- `statusChanged`: User status changed
- `lockAcquired`: Lock acquired
- `lockReleased`: Lock released
- `eventPublished`: Event published

## Configuration

### Redis Configuration

```typescript
{
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'optional',
    db: 0,
    keyPrefix: 'collabornest:',
  }
}
```

### RabbitMQ Configuration (Optional)

```typescript
{
  rabbitmq: {
    url: 'amqp://localhost:5672',
    exchange: 'collabornest.events',
    queue: 'collabornest.reconciliation',
  }
}
```

### Presence Configuration

```typescript
{
  presence: {
    heartbeatInterval: 30000, // 30 seconds
    timeout: 60000, // 1 minute
  }
}
```

### Locking Configuration

```typescript
{
  locking: {
    defaultTimeout: 300000, // 5 minutes
    maxTimeout: 3600000, // 1 hour
  }
}
```

### Monitoring Configuration

```typescript
{
  monitoring: {
    enabled: true,
    metricsInterval: 60000, // 1 minute
  }
}
```

## Use Cases

### Healthcare Applications

- Track which healthcare professionals are viewing patient records
- Lock patient records during editing to prevent concurrent modifications
- Reconcile changes from multiple systems
- Monitor system usage and performance

### Gestionale (Business Management)

- Real-time collaboration on documents and forms
- Prevent conflicts when multiple users edit the same data
- Track user activity and presence
- Hierarchical resource management for organizational structures

## Examples

### Example 1: Patient Record Management

```typescript
// Create a patient resource
const patient = await resourceService.createResource(
  'Patient-123',
  ResourceType.ROOT,
);

// Create child resources (visits, tests, etc.)
const visit = await resourceService.createResource(
  'Visit-2024-001',
  ResourceType.CHILD,
  patient.resourceId,
);

// Doctor joins as editor
await presenceService.joinResource(
  'doctor-456',
  patient.resourceId,
  UserRole.EDITOR,
);

// Acquire lock to edit
const lock = await lockingService.acquireLock(
  patient.resourceId,
  'doctor-456',
);

// Publish changes
await reconciliationService.publishEvent(
  patient.resourceId,
  'doctor-456',
  'update',
  { diagnosis: 'Updated diagnosis' },
);

// Release lock
await lockingService.releaseLock(patient.resourceId, 'doctor-456');
```

### Example 2: Document Collaboration

```typescript
// Create document
const doc = await resourceService.createResource(
  'Contract-2024',
  ResourceType.ROOT,
);

// User joins as viewer
await presenceService.joinResource(
  'user-789',
  doc.resourceId,
  UserRole.VIEWER,
);

// Check who's viewing
const presence = await presenceService.getResourcePresence(doc.resourceId);
console.log('Current viewers:', presence);

// Check if document is locked
const isLocked = await lockingService.isLocked(doc.resourceId);
console.log('Document locked:', isLocked);
```

## Testing

```bash
npm test
```

## Building

```bash
npm run build
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please use the GitHub issue tracker.
