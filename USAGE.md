# CollaborNest Usage Guide

This guide provides detailed examples and best practices for using CollaborNest in your applications.

## Table of Contents

1. [Setup](#setup)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

## Setup

### Prerequisites

- Node.js >= 16
- Redis server
- RabbitMQ server (optional, for event reconciliation)

### Installation

```bash
npm install collabornest @nestjs/common @nestjs/core @nestjs/websockets socket.io ioredis amqplib
```

### Quick Setup with Docker

Use the provided `docker-compose.yml` to run Redis and RabbitMQ locally:

```bash
docker-compose up -d
```

## Basic Usage

### 1. Module Configuration

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
    }),
  ],
})
export class AppModule {}
```

### 2. Using Services in Controllers

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { PresenceService, LockingService, UserRole } from 'collabornest';

@Controller('collaboration')
export class CollaborationController {
  constructor(
    private presenceService: PresenceService,
    private lockingService: LockingService,
  ) {}

  @Post('join')
  async join(@Body() data: { userId: string; resourceId: string }) {
    // User joins a resource
    await this.presenceService.joinResource(
      data.userId,
      data.resourceId,
      UserRole.EDITOR,
    );

    // Acquire lock for editing
    const lock = await this.lockingService.acquireLock(
      data.resourceId,
      data.userId,
    );

    return { success: true, lock };
  }
}
```

### 3. WebSocket Client

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Join a resource
socket.emit('joinResource', {
  userId: 'user-123',
  resourceId: 'doc-456',
  role: 'editor',
});

// Listen for other users
socket.on('userJoined', (data) => {
  console.log('User joined:', data);
});

// Acquire lock
socket.emit('acquireLock', {
  userId: 'user-123',
  resourceId: 'doc-456',
});
```

## Advanced Features

### Hierarchical Resources

```typescript
import { ResourceService, ResourceType } from 'collabornest';

// Create a patient record (root)
const patient = await resourceService.createResource(
  'Patient-001',
  ResourceType.ROOT,
);

// Create visit records (children)
const visit1 = await resourceService.createResource(
  'Visit-2024-01',
  ResourceType.CHILD,
  patient.resourceId,
);

const visit2 = await resourceService.createResource(
  'Visit-2024-02',
  ResourceType.CHILD,
  patient.resourceId,
);

// Get all visits for a patient
const visits = await resourceService.getChildren(patient.resourceId);
```

### Event Reconciliation

```typescript
import { ReconciliationService } from 'collabornest';

// Publish an event
await reconciliationService.publishEvent(
  resourceId,
  userId,
  'data.updated',
  {
    field: 'diagnosis',
    oldValue: 'Unknown',
    newValue: 'Confirmed',
  },
);

// Get all events for reconciliation
const events = await reconciliationService.getUnreconciledEvents(resourceId);

// Process events
for (const event of events) {
  // Process the event
  await processEvent(event);
  
  // Mark as reconciled
  await reconciliationService.markAsReconciled(event.eventId);
}
```

### Monitoring

```typescript
import { MonitoringService } from 'collabornest';

// Get current metrics
const metrics = await monitoringService.getMetrics();
console.log('Active users:', metrics.totalUsers);
console.log('Active locks:', metrics.totalLocks);

// Get historical data
const history = await monitoringService.getMetricsHistory(24); // Last 24 hours
```

### Lock Renewal

```typescript
// Acquire lock with 5 minute timeout
const lock = await lockingService.acquireLock(resourceId, userId, 300000);

// Renew lock for another 5 minutes
const renewed = await lockingService.renewLock(resourceId, userId, 300000);
```

## Best Practices

### 1. Heartbeat Management

Always send heartbeats to maintain presence:

```typescript
// Send heartbeat every 30 seconds
setInterval(async () => {
  await presenceService.updateHeartbeat(userId, resourceId);
}, 30000);
```

### 2. Lock Timeout

Choose appropriate lock timeouts based on your use case:

```typescript
// Short timeout for quick edits (1 minute)
await lockingService.acquireLock(resourceId, userId, 60000);

// Long timeout for complex operations (30 minutes)
await lockingService.acquireLock(resourceId, userId, 1800000);
```

### 3. Cleanup

Always clean up when users leave:

```typescript
// On component unmount or disconnect
await presenceService.leaveResource(userId, resourceId);
await lockingService.releaseLock(resourceId, userId);
```

### 4. Error Handling

```typescript
try {
  const lock = await lockingService.acquireLock(resourceId, userId);
  if (!lock) {
    // Resource is already locked
    const existingLock = await lockingService.getLock(resourceId);
    console.log('Locked by:', existingLock.userId);
    // Notify user or wait
  }
} catch (error) {
  console.error('Failed to acquire lock:', error);
}
```

### 5. Role-Based Access

```typescript
// Check user role before allowing operations
const role = await rolesService.getRole(userId, resourceId);

if (role === UserRole.EDITOR) {
  // Allow editing
  await lockingService.acquireLock(resourceId, userId);
} else {
  // Read-only access
  console.log('User is a viewer, editing not allowed');
}
```

## Troubleshooting

### Connection Issues

**Problem**: Can't connect to Redis

**Solution**:
```typescript
// Check Redis configuration
{
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password', // If required
    retryStrategy: (times) => Math.min(times * 50, 2000),
  }
}
```

### Lock Not Releasing

**Problem**: Locks are not being released

**Solution**:
- Ensure you call `releaseLock()` in all exit paths
- Use try-finally blocks
- Set appropriate timeouts so locks auto-expire

```typescript
try {
  await lockingService.acquireLock(resourceId, userId);
  // Do work
} finally {
  await lockingService.releaseLock(resourceId, userId);
}
```

### Presence Not Updating

**Problem**: User presence shows as offline

**Solution**:
- Ensure heartbeats are being sent regularly
- Check network connectivity
- Verify timeout configuration is appropriate

### Memory Issues

**Problem**: Redis memory growing

**Solution**:
- Set appropriate TTLs for presence and locks
- Clean up old metrics data
- Use Redis maxmemory policies

```typescript
{
  presence: {
    timeout: 60000, // 1 minute - presence expires after this
  },
  monitoring: {
    enabled: true,
    metricsInterval: 300000, // Collect less frequently
  }
}
```

## Performance Tips

1. **Batch Operations**: Group multiple operations when possible
2. **Connection Pooling**: Reuse Redis connections
3. **Monitoring**: Enable monitoring to track performance
4. **Indexing**: Use appropriate Redis key patterns for efficient queries
5. **Cleanup**: Regularly clean up expired data

## Security Considerations

1. **Authentication**: Always validate user identity before operations
2. **Authorization**: Check permissions before allowing lock acquisition
3. **Data Validation**: Validate all input data
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Encryption**: Use TLS for Redis and RabbitMQ connections in production

## Support

For issues and questions:
- GitHub Issues: https://github.com/awesomecit/collabornest/issues
- Documentation: https://github.com/awesomecit/collabornest#readme
