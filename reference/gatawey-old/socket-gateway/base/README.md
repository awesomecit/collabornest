# BaseSocketGateway - Abstract WebSocket Infrastructure

## 📋 Overview

`BaseSocketGateway` is an abstract base class that provides **reusable WebSocket infrastructure** for NestJS + Socket.IO applications. It implements the **Template Method Pattern** to separate generic infrastructure concerns from domain-specific business logic.

## 🎯 Purpose

- **Eliminate Code Duplication**: Write authentication, connection management, and error handling **once**
- **Separation of Concerns**: Infrastructure (BaseSocketGateway) vs Business Logic (Subclasses)
- **Consistent Behavior**: All gateways follow the same lifecycle, logging, and error handling patterns
- **Easy Extension**: Implement 2 abstract hooks and you're done

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **JWT Authentication** | Automatic token validation with Keycloak payload extraction |
| 🔌 **Connection Pool** | Track all active connections with metadata (userId, transport, connectedAt) |
| 👥 **Max Connections** | Enforce connection limits per user |
| 📊 **Enhanced Logging** | Structured logging with session duration, disconnect categorization, metadata |
| 🛡️ **Error Handling** | Centralized SocketException pattern with client notification |
| ♻️ **Memory Management** | Automatic listener cleanup to prevent memory leaks |
| 🚦 **Graceful Shutdown** | Notify clients, wait for acknowledgments, force disconnect after timeout |
| 🎣 **Template Hooks** | Subclass customization via `onClientAuthenticated()` and `onClientDisconnecting()` |

## 🏗️ Architecture

### Inheritance Hierarchy

```
BaseSocketGateway (abstract)
   ↓ extends
CollaborationSocketGateway (concrete)
   ↓ extends (future)
NotificationSocketGateway (concrete)
   ↓ extends (future)
AnalyticsSocketGateway (concrete)
```

### Template Method Pattern

```typescript
// BaseSocketGateway provides infrastructure
handleConnection(client) {
  authenticateClient(client)       // ✅ Implemented (JWT validation)
  onClientAuthenticated(client)   // ⚠️ Abstract hook (subclass implements)
  addToConnectionPool(client)      // ✅ Implemented
}

handleDisconnect(client) {
  onClientDisconnecting(client)   // ⚠️ Abstract hook (subclass implements)
  removeFromConnectionPool(client) // ✅ Implemented
  logDetailedDisconnection(client) // ✅ Implemented
}
```

## 🚀 Quick Start

### Step 1: Create Your Gateway

```typescript
import { Injectable } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
import { BaseSocketGateway } from './base/base-socket-gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { TypedSocket } from './socket-gateway.types';

@Injectable()
@WebSocketGateway({ namespace: '/my-feature' })
export class MyFeatureGateway extends BaseSocketGateway {
  constructor(configService: SocketGatewayConfigService) {
    super(configService, MyFeatureGateway.name);
  }

  // Hook 1: Called after successful authentication
  protected onClientAuthenticated(client: TypedSocket): void {
    // Your custom initialization
    const userId = client.data.user.userId;
    console.log(`User ${userId} authenticated for MyFeature`);
    
    // Example: Load user preferences, join default rooms, etc.
  }

  // Hook 2: Called before disconnect processing
  protected onClientDisconnecting(client: TypedSocket): void {
    // Your custom cleanup
    const userId = client.data.user.userId;
    console.log(`User ${userId} disconnecting from MyFeature`);
    
    // Example: Leave rooms, notify other users, save state, etc.
  }

  // Add your domain-specific message handlers
  @SubscribeMessage('feature:action')
  handleFeatureAction(@MessageBody() data: any, @ConnectedSocket() client: TypedSocket) {
    try {
      // Your business logic here
      client.emit('feature:response', { success: true });
    } catch (error) {
      // Use centralized error handler
      this.handleSocketError(error, client, 'feature:action');
    }
  }
}
```

### Step 2: Register in Module

```typescript
@Module({
  providers: [
    MyFeatureGateway,
    SocketGatewayConfigService,
  ],
  exports: [MyFeatureGateway],
})
export class MyFeatureModule {}
```

### Step 3: Configure (Optional)

BaseSocketGateway reads configuration from `SocketGatewayConfigService`:

```typescript
// In your .env or config
SOCKET_GATEWAY_ENABLED=true
SOCKET_GATEWAY_MAX_CONNECTIONS_PER_USER=5
SOCKET_GATEWAY_PING_INTERVAL=25000
SOCKET_GATEWAY_PING_TIMEOUT=20000
```

## 📚 API Reference

### Abstract Hooks (Must Implement)

#### `onClientAuthenticated(client: TypedSocket): void`

Called **after** successful JWT authentication but **before** connection is fully established.

**Use Cases:**
- Load user-specific data
- Join default rooms
- Initialize user state
- Send welcome messages

**Example:**
```typescript
protected onClientAuthenticated(client: TypedSocket): void {
  const { userId, username } = client.data.user;
  
  // Join user's personal room
  client.join(`user:${userId}`);
  
  // Send welcome message
  client.emit('welcome', {
    message: `Hello ${username}!`,
    timestamp: Date.now(),
  });
}
```

#### `onClientDisconnecting(client: TypedSocket): void`

Called **before** disconnect is processed, while connection pool still has client info.

**Use Cases:**
- Leave rooms and notify other users
- Save user state
- Cleanup resources
- Log business-specific events

**Example:**
```typescript
protected onClientDisconnecting(client: TypedSocket): void {
  const { userId, username } = client.data.user;
  
  // Notify other users in shared rooms
  const rooms = Array.from(client.rooms);
  rooms.forEach(room => {
    client.to(room).emit('user_left', { userId, username });
  });
  
  // Save user's last activity
  this.userService.updateLastSeen(userId);
}
```

### Protected Methods (Available to Subclasses)

#### `getUserConnections(userId: string): string[]`

Get all socket IDs for a specific user.

**Returns:** Array of socket IDs

**Example:**
```typescript
const socketIds = this.getUserConnections('user-123');
console.log(`User has ${socketIds.length} active connections`);

// Emit to all user's connections
socketIds.forEach(socketId => {
  this.server.to(socketId).emit('notification', data);
});
```

#### `handleSocketError(error: Error, client: TypedSocket, eventName?: string): void`

Centralized error handler with structured logging and client notification.

**Parameters:**
- `error`: Error object (SocketException or generic Error)
- `client`: Socket client where error occurred
- `eventName`: Optional event name for context

**Example:**
```typescript
@SubscribeMessage('complex:operation')
handleComplexOperation(@MessageBody() data: any, @ConnectedSocket() client: TypedSocket) {
  try {
    // Validation
    if (!data.required) {
      throw new SocketException(
        SocketErrorCategory.VALIDATION,
        'MISSING_FIELD',
        'Required field is missing',
        { field: 'required' }
      );
    }
    
    // Business logic
    const result = this.processData(data);
    client.emit('complex:result', result);
    
  } catch (error) {
    // Centralized error handling
    this.handleSocketError(error, client, 'complex:operation');
  }
}
```

### Lifecycle Hooks (Auto-Implemented)

These are automatically called by NestJS and already implemented in BaseSocketGateway:

| Hook | When Called | What It Does |
|------|-------------|--------------|
| `afterInit(server)` | After WebSocket server initialization | Logs config, sets up ping/pong |
| `handleConnection(client)` | New client connects | Authenticates, adds to pool, calls `onClientAuthenticated()` |
| `handleDisconnect(client)` | Client disconnects | Calls `onClientDisconnecting()`, removes from pool, logs details |
| `onApplicationShutdown(signal)` | App shutdown (SIGTERM, etc.) | Graceful shutdown with client notification |

## 🧪 Testing

### Unit Testing Your Gateway

```typescript
import { Test } from '@nestjs/testing';
import { MyFeatureGateway } from './my-feature.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';

describe('MyFeatureGateway', () => {
  let gateway: MyFeatureGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      isEnabled: jest.fn().mockReturnValue(true),
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(999),
      logClientConnected: jest.fn(),
      logClientDisconnected: jest.fn(),
      // ... other mocked methods
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        MyFeatureGateway,
        {
          provide: SocketGatewayConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    gateway = module.get<MyFeatureGateway>(MyFeatureGateway);
    
    // Mock server
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as any;
  });

  it('should call onClientAuthenticated hook on connection', () => {
    const spyHook = jest.spyOn(gateway as any, 'onClientAuthenticated');
    
    const mockClient = createMockClient('socket-123');
    gateway.handleConnection(mockClient);
    
    expect(spyHook).toHaveBeenCalledWith(mockClient);
  });
});
```

### Integration Testing

```typescript
describe('MyFeatureGateway Integration', () => {
  let app: INestApplication;
  let gateway: MyFeatureGateway;
  let client: Socket;

  beforeAll(async () => {
    // Setup NestJS app with gateway
    const module = await Test.createTestingModule({
      providers: [MyFeatureGateway, SocketGatewayConfigService],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    await app.listen(3001);

    gateway = module.get<MyFeatureGateway>(MyFeatureGateway);
  });

  beforeEach(() => {
    // Create real Socket.IO client
    client = io('http://localhost:3001/my-feature', {
      auth: { token: 'valid-jwt-token' },
    });
  });

  it('should authenticate and receive welcome message', (done) => {
    client.on('welcome', (data) => {
      expect(data.message).toContain('Hello');
      done();
    });
  });
});
```

## 🔍 Logging

BaseSocketGateway provides structured logging for all lifecycle events:

### Connection Events

```json
{
  "event": "CLIENT_CONNECTED",
  "socketId": "abc123",
  "userId": "user-456",
  "username": "john.doe",
  "transport": "websocket",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

### Disconnection Events

```json
{
  "event": "CLIENT_DISCONNECTED",
  "socketId": "abc123",
  "userId": "user-456",
  "username": "john.doe",
  "sessionDuration": 120000,
  "sessionDurationMinutes": 2,
  "disconnectReason": "client namespace disconnect",
  "disconnectCategory": "VOLUNTARY",
  "transport": "websocket",
  "ip": "192.168.1.100",
  "timestamp": "2025-11-12T10:32:00.000Z"
}
```

### Error Events

```json
{
  "event": "SOCKET_ERROR",
  "category": "VALIDATION",
  "errorCode": "MISSING_FIELD",
  "message": "Required field is missing",
  "socketId": "abc123",
  "userId": "user-456",
  "eventName": "feature:action",
  "isOperational": true
}
```

## 🔧 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable gateway |
| `maxConnectionsPerUser` | number | `5` | Max concurrent connections per user |
| `pingInterval` | number | `25000` | Heartbeat interval (ms) |
| `pingTimeout` | number | `20000` | Heartbeat timeout (ms) |
| `shutdownTimeout` | number | `5000` | Graceful shutdown timeout (ms) |

## 🐛 Troubleshooting

### Issue: "Cannot access protected property 'server'"

**Solution:** Override as public in subclass for testing:
```typescript
export class MyFeatureGateway extends BaseSocketGateway {
  public server!: any; // Override for test access
}
```

### Issue: "Max connections exceeded"

**Solution:** Configure higher limit:
```typescript
getMaxConnectionsPerUser(): number {
  return 10; // Increase limit
}
```

### Issue: "Authentication failed with valid token"

**Solution:** Check JWT payload structure. BaseSocketGateway expects:
```json
{
  "sub": "userId",
  "preferred_username": "username",
  "given_name": "First",
  "family_name": "Last",
  "email": "user@example.com",
  "realm_access": { "roles": ["user"] }
}
```

## 📖 Related Documentation

- [CollaborationSocketGateway](../socket-gateway.gateway.ts) - Example implementation for surgery collaboration
- [REFACTOR_2.1_EXTRACT_BASE_GATEWAY_PLAN.md](../../REFACTOR_2.1_EXTRACT_BASE_GATEWAY_PLAN.md) - Full refactoring specification
- [WEBSOCKET_TASKS.md](../../WEBSOCKET_TASKS.md) - Task tracking and requirements

## 🎓 Best Practices

1. **Keep Hooks Lightweight**: Move heavy operations to background jobs
2. **Use Centralized Error Handler**: Always wrap message handlers in try-catch and use `handleSocketError()`
3. **Clean Up Resources**: Always cleanup in `onClientDisconnecting()`
4. **Type Safety**: Use `TypedSocket` instead of raw `Socket` for type-safe access to `client.data`
5. **Test Both Hooks**: Write unit tests for both `onClientAuthenticated()` and `onClientDisconnecting()`
6. **Monitor Connection Pool**: Use `getUserConnections()` for debugging connection issues
7. **Graceful Degradation**: Handle errors without disconnecting clients (emit error events instead)

## 📝 License

Part of SISOS Service - Internal Use Only

---

**Maintainer:** SIS-582 - WebSocket Infrastructure Refactoring  
**Last Updated:** November 2025
