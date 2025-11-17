# COPILOT SPEC: Resource Config + Health + API Standards

**Target**: Update README, ROADMAP, API docs
**Context**: CollaborNest WebSocket Gateway (NestJS + Socket.IO + Redis)
**Current**: BE-001.3 locks in development, hierarchical resources `type:id/subType:subId` exist
**Version**: 1.0.0 | Nov 18, 2025

---

## 🎯 3 FEATURES TO IMPLEMENT

### 1. Resource Configuration System

### 2. Health/Readiness Endpoints

### 3. API Consumer/Producer Standards

---

## 📋 FEATURE 1: Resource Configuration System

**Goal**: Definire mappa risorse con limiti, concorrenza, vincoli per ruoli - caricata all'avvio

### Struttura Config File: `config/resources.yml`

```yaml
resources:
  # Root resource type definitions
  document:
    displayName: 'Clinical Document'
    maxConcurrentEditors: 1 # BE-001.3 decision
    maxViewers: 50 # Per resource limit
    lockTTL: 300 # 5 minutes (seconds)
    heartbeatInterval: 60 # 60 seconds

    # Role-based permissions
    roles:
      surgeon:
        canEdit: true
        canLock: true
        canForceRelease: false # Decision 5: No admin override
      nurse:
        canEdit: true
        canLock: true
        canForceRelease: false
      viewer:
        canEdit: false
        canLock: false
        canForceRelease: false

    # Sub-resource definitions (hierarchical)
    subResources:
      section:
        displayName: 'Document Section'
        maxConcurrentEditors: 1
        maxViewers: 20
        independentLocks: true # Each section has own lock

      annotation:
        displayName: 'Annotation'
        maxConcurrentEditors: 5 # Multiple annotations allowed
        maxViewers: null # Unlimited
        independentLocks: true

  surgery-management:
    displayName: 'Surgery Management'
    maxConcurrentEditors: 1
    maxViewers: 10 # Sensitive, fewer viewers
    lockTTL: 600 # 10 minutes for OR
    heartbeatInterval: 60

    roles:
      surgeon:
        canEdit: true
        canLock: true
        canForceRelease: true # Surgery = override allowed
      anesthesiologist:
        canEdit: true
        canLock: true
        canForceRelease: false
      nurse:
        canEdit: false
        canLock: false
        canForceRelease: false

    subResources:
      field:
        displayName: 'Surgery Field'
        maxConcurrentEditors: 1
        maxViewers: 5
        independentLocks: true

      vital-signs:
        displayName: 'Vital Signs'
        maxConcurrentEditors: 1
        maxViewers: 20
        independentLocks: true

  patient-chart:
    displayName: 'Patient Chart'
    maxConcurrentEditors: 3 # Multiple staff can edit different sections
    maxViewers: null # Unlimited (collaborative)
    lockTTL: 300
    heartbeatInterval: 60

    roles:
      doctor:
        canEdit: true
        canLock: true
        canForceRelease: false
      nurse:
        canEdit: true
        canLock: true
        canForceRelease: false
      admin:
        canEdit: true
        canLock: true
        canForceRelease: true

# Global defaults (fallback)
defaults:
  maxConcurrentEditors: 1
  maxViewers: 50
  lockTTL: 300
  heartbeatInterval: 60
  gracePerio: 30 # BE-001.3 Decision 3
```

### Implementation Requirements

**File**: `src/websocket-gateway/config/resource-config.service.ts`

```typescript
@Injectable()
export class ResourceConfigService {
  private resourceMap: Map<string, ResourceConfig>;

  constructor() {
    this.loadConfig(); // Load YAML at startup
  }

  // Get config for resourceId (e.g., "document:123:section:5")
  getConfig(resourceId: string): ResourceConfig {
    const { type, subType } = parseResourceId(resourceId);
    return this.resourceMap.get(`${type}/${subType || 'root'}`);
  }

  // Check if user can perform action
  canPerformAction(
    resourceId: string,
    userId: string,
    action: 'edit' | 'lock' | 'forceRelease',
  ): boolean {
    const config = this.getConfig(resourceId);
    const userRole = this.getUserRole(userId); // From JWT or DB
    return config.roles[userRole]?.[`can${capitalize(action)}`] || false;
  }

  // Get limits for resource
  getLimits(resourceId: string): {
    maxEditors: number;
    maxViewers: number | null;
    lockTTL: number;
    heartbeat: number;
  } {
    const config = this.getConfig(resourceId);
    return {
      maxEditors: config.maxConcurrentEditors,
      maxViewers: config.maxViewers,
      lockTTL: config.lockTTL,
      heartbeat: config.heartbeatInterval,
    };
  }
}
```

### Interface Definitions

```typescript
interface ResourceConfig {
  displayName: string;
  maxConcurrentEditors: number;
  maxViewers: number | null; // null = unlimited
  lockTTL: number; // seconds
  heartbeatInterval: number; // seconds
  roles: Record<string, RolePermissions>;
  subResources?: Record<string, ResourceConfig>;
}

interface RolePermissions {
  canEdit: boolean;
  canLock: boolean;
  canForceRelease: boolean;
}
```

### Integration Points

1. **Lock Acquisition**: Check `maxConcurrentEditors` before granting lock
2. **Join Resource**: Check `maxViewers` before allowing viewer join
3. **Role Validation**: Check `canEdit`/`canLock` based on user role
4. **TTL/Heartbeat**: Use config values instead of hardcoded

---

## 🏥 FEATURE 2: Health/Readiness Endpoints

**Goal**: Esporre endpoint per verificare stato servizi prima di usare API

### Endpoints da Implementare

#### 1. Health Check (Liveness)

**Endpoint**: `GET /health`
**Purpose**: È il server vivo?

```typescript
// Response
{
  "status": "ok" | "error",
  "timestamp": "2025-11-18T10:00:00Z",
  "uptime": 3600,  // seconds
  "version": "1.0.0"
}
```

#### 2. Readiness Check (Readiness)

**Endpoint**: `GET /ready`
**Purpose**: Tutti i servizi dipendenti sono pronti?

```typescript
// Response
{
  "status": "ready" | "not_ready",
  "timestamp": "2025-11-18T10:00:00Z",
  "services": {
    "database": {
      "status": "up",
      "latency": 5  // ms
    },
    "redis": {
      "status": "up",
      "latency": 2
    },
    "websocket": {
      "status": "up",
      "connections": 42
    }
  },
  "checks": {
    "canAcceptConnections": true,
    "hasResourceConfig": true,
    "redisLockServiceReady": true
  }
}
```

#### 3. API Capabilities

**Endpoint**: `GET /api/capabilities`
**Purpose**: Quali API/eventi sono disponibili?

```typescript
// Response
{
  "version": "1.0.0",
  "features": {
    "websocket": {
      "enabled": true,
      "namespace": "/collaboration",
      "path": "/ws/socket.io",
      "events": [
        "resource:join",
        "resource:leave",
        "lock:acquire",
        "lock:release",
        "lock:heartbeat"
      ]
    },
    "locks": {
      "enabled": true,
      "provider": "redis",
      "features": [
        "exclusive-locks",
        "ttl-expiry",
        "heartbeat-renewal",
        "hierarchical-locks"
      ]
    },
    "presence": {
      "enabled": true,
      "tracking": "in-memory",
      "features": [
        "multi-user",
        "role-based",
        "real-time-broadcast"
      ]
    }
  },
  "limits": {
    "maxConnectionsPerUser": 5,
    "defaultLockTTL": 300,
    "defaultHeartbeat": 60
  },
  "resourceTypes": [
    {
      "type": "document",
      "subTypes": ["section", "annotation"],
      "maxEditors": 1,
      "maxViewers": 50
    },
    {
      "type": "surgery-management",
      "subTypes": ["field", "vital-signs"],
      "maxEditors": 1,
      "maxViewers": 10
    }
  ]
}
```

### Implementation

**File**: `src/health/health.controller.ts`

```typescript
@Controller()
export class HealthController {
  constructor(
    private readonly resourceConfig: ResourceConfigService,
    private readonly redis: RedisService,
    private readonly wsGateway: WebSocketGateway,
  ) {}

  @Get('health')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
    };
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    const redis = await this.checkRedis();
    const ws = this.checkWebSocket();
    const config = this.checkResourceConfig();

    const isReady = redis.status === 'up' && ws.status === 'up' && config;

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: { redis, websocket: ws },
      checks: {
        canAcceptConnections: ws.status === 'up',
        hasResourceConfig: config,
        redisLockServiceReady: redis.status === 'up',
      },
    };
  }

  @Get('api/capabilities')
  getCapabilities(): CapabilitiesResponse {
    const config = this.resourceConfig.getAllConfigs();
    return {
      version: '1.0.0',
      features: {
        /* ... */
      },
      limits: {
        /* ... */
      },
      resourceTypes: config.map(c => ({
        type: c.type,
        subTypes: Object.keys(c.subResources || {}),
        maxEditors: c.maxConcurrentEditors,
        maxViewers: c.maxViewers,
      })),
    };
  }
}
```

---

## 📡 FEATURE 3: API Consumer/Producer Standards

**Goal**: Guideline standard per consumer/producer - eventi, stati, revisioni, vincoli

### API Contract Standard

#### Event Flow Pattern

```typescript
// 1. CLIENT → SERVER (Request)
interface ApiRequest<T = any> {
  action: string; // "update", "lock", "release"
  resourceId: string; // "document:123:section:5"
  payload: T; // Action-specific data
  revision?: number; // Optional: current revision client has
  requestId: string; // UUID for tracing
  timestamp: string; // ISO 8601
}

// 2. SERVER → CLIENT (Response)
interface ApiResponse<T = any> {
  success: boolean;
  requestId: string; // Match request
  data?: T; // Success payload
  error?: ApiError; // Error details
  newRevision?: number; // New revision after update
  resourceState?: ResourceState; // Full state if needed
  timestamp: string;
}

// 3. SERVER → ALL CLIENTS (Broadcast)
interface ApiBroadcast<T = any> {
  event: string; // "resource:updated", "lock:acquired"
  resourceId: string;
  payload: T;
  triggeredBy: {
    userId: string;
    username: string;
    action: string; // What caused broadcast
  };
  newRevision: number; // Always include revision
  timestamp: string;
}
```

#### Error Standard

```typescript
interface ApiError {
  code: string; // "LOCK_HELD", "INVALID_STATE", "PERMISSION_DENIED"
  message: string; // Human-readable
  details?: {
    currentState?: string; // Current resource state
    requiredState?: string; // Required state for action
    holder?: string; // Who holds lock (if applicable)
    expiresAt?: string; // When lock expires
  };
}
```

### Resource State Machine

```typescript
enum ResourceState {
  AVAILABLE = 'AVAILABLE', // No locks, can be edited
  LOCKED = 'LOCKED', // Editor lock held
  READ_ONLY = 'READ_ONLY', // Administratively locked
  ARCHIVED = 'ARCHIVED', // Cannot be edited
  DELETED = 'DELETED', // Soft-deleted
}

interface ResourceStateTransition {
  from: ResourceState;
  to: ResourceState;
  action: string; // "lock:acquire", "admin:archive"
  requires: {
    role?: string[]; // Roles that can trigger
    condition?: string; // "no active editors", "is owner"
  };
}

// State Transition Map
const stateTransitions: ResourceStateTransition[] = [
  {
    from: ResourceState.AVAILABLE,
    to: ResourceState.LOCKED,
    action: 'lock:acquire',
    requires: { condition: 'no active lock' },
  },
  {
    from: ResourceState.LOCKED,
    to: ResourceState.AVAILABLE,
    action: 'lock:release',
    requires: { condition: 'is lock holder' },
  },
  {
    from: ResourceState.LOCKED,
    to: ResourceState.READ_ONLY,
    action: 'admin:lock',
    requires: { role: ['admin', 'surgeon'] }, // From config
  },
  {
    from: ResourceState.READ_ONLY,
    to: ResourceState.AVAILABLE,
    action: 'admin:unlock',
    requires: { role: ['admin', 'surgeon'] },
  },
];
```

### Consumer/Producer Guidelines

#### CONSUMER (UI/External Service)

**1. Before Making Request**:

```typescript
// Check API is ready
const ready = await fetch('/ready').then(r => r.json());
if (ready.status !== 'ready') {
  throw new Error('Backend not ready');
}

// Get capabilities
const caps = await fetch('/api/capabilities').then(r => r.json());
if (!caps.features.locks.enabled) {
  throw new Error('Locks not available');
}
```

**2. Making Request**:

```typescript
// Include revision for optimistic locking
socket.emit('resource:update', {
  action: 'update',
  resourceId: 'document:123:section:5',
  payload: { content: 'New text...' },
  revision: currentRevision, // Client's current revision
  requestId: uuidv4(),
  timestamp: new Date().toISOString(),
});
```

**3. Handling Response**:

```typescript
socket.on('resource:updated', (response: ApiResponse) => {
  if (response.success) {
    // Update local state with new revision
    updateLocalState(response.data, response.newRevision);
  } else {
    // Handle conflict
    if (response.error.code === 'STALE_REVISION') {
      // Reload resource state
      fetchLatestState(response.resourceState);
    } else if (response.error.code === 'LOCK_HELD') {
      // Show lock holder
      showToast(`Locked by ${response.error.details.holder}`);
    }
  }
});
```

#### PRODUCER (Backend)

**1. State Validation**:

```typescript
// Before processing request
const currentState = await getResourceState(resourceId);
const isValidTransition = canTransition(
  currentState.state,
  requestedAction,
  userRole,
);

if (!isValidTransition) {
  return {
    success: false,
    error: {
      code: 'INVALID_STATE_TRANSITION',
      message: `Cannot ${requestedAction} from ${currentState.state}`,
      details: {
        currentState: currentState.state,
        requiredState: 'AVAILABLE',
      },
    },
  };
}
```

**2. Optimistic Locking**:

```typescript
// Check revision before update
if (request.revision && request.revision !== currentState.revision) {
  return {
    success: false,
    error: {
      code: 'STALE_REVISION',
      message: 'Resource updated by another user',
      details: {
        clientRevision: request.revision,
        serverRevision: currentState.revision,
      },
    },
    resourceState: currentState, // Send full state for reload
  };
}
```

**3. Broadcasting Updates**:

```typescript
// After successful update, broadcast to all
const broadcast: ApiBroadcast = {
  event: 'resource:updated',
  resourceId,
  payload: updatedData,
  triggeredBy: {
    userId: user.id,
    username: user.username,
    action: 'update',
  },
  newRevision: newRevision,
  timestamp: new Date().toISOString(),
};

// Emit to all EXCEPT requester
socket.to(resourceId).emit('resource:updated', broadcast);

// Confirm to requester
socket.emit('resource:updated', {
  success: true,
  requestId: request.requestId,
  data: updatedData,
  newRevision: newRevision,
  timestamp: new Date().toISOString(),
});
```

### Event Naming Convention

**Pattern**: `entity:action` or `entity:action:result`

```typescript
// Requests (Client → Server)
'resource:join';
'resource:leave';
'lock:acquire';
'lock:release';
'lock:heartbeat';
'resource:update';

// Responses (Server → Client)
'resource:joined'; // Success
'resource:join:failed'; // Error
'lock:acquired';
'lock:denied';

// Broadcasts (Server → All)
'resource:updated';
'lock:released';
'lock:expired';
'user:joined';
'user:left';
'state:changed';
```

### Transport Guidelines

**WebSocket** (real-time bidirectional):

- User presence
- Locks
- Real-time updates
- Collaborative editing

**HTTP REST** (request/response):

- CRUD operations
- Health checks
- Configuration
- Authentication

**Message Queue** (async decoupled):

- Audit logs
- Email notifications
- Backup/archival
- Analytics

---

## 📝 DOCUMENTATION UPDATES NEEDED

### 1. README.md

Add sections:

- **Resource Configuration**: Link to `resources.yml` and explain hierarchy
- **Health Endpoints**: Document `/health`, `/ready`, `/api/capabilities`
- **API Standards**: Link to consumer/producer guidelines

### 2. ROADMAP.md

Add features:

- **BE-001.6**: Resource Configuration System (Week 5)
- **BE-001.7**: Health/Readiness Endpoints (Week 5)
- **BE-001.8**: API Standards Documentation (Week 5)

### 3. New Files to Create

- `docs/RESOURCE_CONFIGURATION.md` - Full config schema + examples
- `docs/API_STANDARDS.md` - Complete consumer/producer guide
- `docs/STATE_MACHINE.md` - Resource state transitions diagram

### 4. Update Existing

- `docs/BACKEND_RESPONSE_TO_UI_FEEDBACK.md` - Add capabilities endpoint
- `docs/project/BACKLOG.md` - Add new features to backlog
- `.env.template` - Add resource config path variable

---

## ⚙️ IMPLEMENTATION CHECKLIST

**Resource Config System**:

- [ ] Create `ResourceConfigService`
- [ ] Load `resources.yml` at startup
- [ ] Integrate with lock acquisition
- [ ] Integrate with join resource
- [ ] Add role validation
- [ ] Write unit tests

**Health Endpoints**:

- [ ] Implement `/health`
- [ ] Implement `/ready`
- [ ] Implement `/api/capabilities`
- [ ] Add service health checks
- [ ] Add integration tests

**API Standards**:

- [ ] Define `ApiRequest`/`ApiResponse` interfaces
- [ ] Implement state machine
- [ ] Add revision tracking
- [ ] Update event payloads to include revisions
- [ ] Document in `API_STANDARDS.md`

**Documentation**:

- [ ] Update README with new features
- [ ] Update ROADMAP with Week 5+ features
- [ ] Create `RESOURCE_CONFIGURATION.md`
- [ ] Create `API_STANDARDS.md`
- [ ] Create `STATE_MACHINE.md`

---

## 🎯 SUMMARY FOR COPILOT

**What to do**:

1. Read this spec
2. Update README with resource config, health endpoints, API standards sections
3. Update ROADMAP with BE-001.6, BE-001.7, BE-001.8 features
4. Create skeleton for new docs (RESOURCE_CONFIGURATION, API_STANDARDS, STATE_MACHINE)
5. Update .env.template with new config vars

**Priority**: Medium (after BE-001.3 locks complete)
**Timeline**: Week 5 implementation
**Complexity**: Medium

**Key Principles**:

- Config-driven (YAML file)
- Health-first (endpoints before operations)
- Standard API contracts (predictable events)
- State machine enforcement (valid transitions only)
- Revision tracking (optimistic locking)

---

**End of Spec** 🎯

DA FARE VALUTARE
