# UI Integration Guidelines - CollaborNest EPIC-004

## 📋 Overview

This guide provides standards for implementing UI features that integrate with the CollaborNest backend's resource management, distributed locking, and real-time collaboration APIs.

**Target Audience**: UI developers implementing new features or extending existing resource editors.

**Prerequisites**:

- Backend exposes `/health` endpoints (health check, readiness, resources, capabilities)
- WebSocket gateway running on configured port (default: 3001)
- Authentication tokens available (JWT)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       UI Application                         │
├─────────────────────────────────────────────────────────────┤
│  Feature Module (e.g., SurgeryEditor)                        │
│  ├─ Resource Config Consumer                                │
│  ├─ Lock Manager (acquire/release/heartbeat)                │
│  ├─ State Transition Handler                                │
│  ├─ WebSocket Event Listener                                │
│  └─ Revision Tracker (optimistic concurrency)               │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ HTTP GET           │ WebSocket          │ HTTP POST
         │ /health/resources  │ Events             │ /api/resources
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Services                          │
├─────────────────────────────────────────────────────────────┤
│  Health Check Controller                                     │
│  WebSocket Gateway (lock events, state changes)             │
│  Resource API (CRUD, state transitions)                     │
│  Distributed Lock Service (Redis-backed)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Checklist

Before implementing a new feature, verify:

- [ ] **Health Check**: `GET /health/ready` returns 200
- [ ] **Resource Config**: `GET /health/resources` includes your resource type
- [ ] **Capabilities**: `GET /health/capabilities` lists required features
- [ ] **WebSocket**: Connection to `ws://localhost:3001` succeeds
- [ ] **Authentication**: JWT token valid and includes required roles

---

## 📦 Step 1: Consume Resource Configuration

### Fetch Configuration on App Load

```typescript
// services/resource-config.service.ts
export class ResourceConfigService {
  async loadConfigurations(): Promise<ResourceConfigMap> {
    const response = await fetch('/health/resources');
    const data = await response.json();

    if (!data.resources || data.resources.length === 0) {
      throw new Error('No resources available');
    }

    // Validate all configs are valid
    for (const [resourceType, status] of Object.entries(
      data.validationStatus,
    )) {
      if (status !== 'valid') {
        console.warn(`Resource ${resourceType} has invalid configuration`);
      }
    }

    return data.configurations;
  }

  getResourceConfig(resourceType: ResourceType): ResourceConfig | null {
    return this.configurations[resourceType] || null;
  }
}
```

### Extract Feature Requirements

```typescript
// features/surgery-editor/surgery-editor.component.ts
export class SurgeryEditorComponent implements OnInit {
  private config: ResourceConfig;

  async ngOnInit() {
    this.config = await this.resourceConfigService.getResourceConfig(
      ResourceType.SURGERY,
    );

    // Extract concurrency limits
    const { maxEditors, maxViewers } = this.config.concurrency;
    console.log(
      `Surgery editor allows ${maxEditors} editor(s), ${maxViewers} viewer(s)`,
    );

    // Extract role permissions
    const mainSubResource = this.config.subResources.find(
      sr => sr.type === SubResourceType.MAIN,
    );
    const canEdit = mainSubResource?.editRoles.includes(this.currentUserRole);

    if (!canEdit) {
      this.switchToReadOnlyMode();
    }

    // Extract state constraints
    const currentState = this.resource.state;
    if (this.config.lockedStates.includes(currentState)) {
      this.disableEditing('Resource is in locked state');
    }
  }
}
```

---

## 🔒 Step 2: Implement Distributed Locking

### Acquire Lock on Edit Intent

```typescript
// services/lock.service.ts
export class LockService {
  private heartbeatInterval: number | null = null;

  async acquireLock(
    resourceType: ResourceType,
    resourceId: string,
    subResourceType: SubResourceType = SubResourceType.MAIN,
  ): Promise<LockResult> {
    const response = await fetch('/api/resources/lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authService.getToken()}`,
      },
      body: JSON.stringify({ resourceType, resourceId, subResourceType }),
    });

    const result = await response.json();

    if (result.acquired) {
      // Start heartbeat
      this.startHeartbeat(resourceType, resourceId);

      // Listen for lock events
      this.listenForLockEvents(resourceType, resourceId);

      return { success: true, expiresAt: result.expiresAt };
    } else {
      return {
        success: false,
        reason: result.denialReason || 'Lock denied by another editor',
      };
    }
  }

  private startHeartbeat(resourceType: ResourceType, resourceId: string) {
    const config = this.resourceConfigService.getResourceConfig(resourceType);
    const interval = config?.heartbeatInterval || 60000; // Default 60s

    this.heartbeatInterval = window.setInterval(async () => {
      await this.sendHeartbeat(resourceType, resourceId);
    }, interval);
  }

  private async sendHeartbeat(resourceType: ResourceType, resourceId: string) {
    try {
      await fetch('/api/resources/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authService.getToken()}`,
        },
        body: JSON.stringify({ resourceType, resourceId }),
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
      this.handleLockLost();
    }
  }

  async releaseLock(resourceType: ResourceType, resourceId: string) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    await fetch('/api/resources/lock', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authService.getToken()}`,
      },
      body: JSON.stringify({ resourceType, resourceId }),
    });
  }
}
```

### Handle Lock Events (WebSocket)

```typescript
// features/surgery-editor/surgery-editor.component.ts
export class SurgeryEditorComponent implements OnInit, OnDestroy {
  private wsSubscription: Subscription;

  ngOnInit() {
    this.wsSubscription = this.websocketService
      .on('LOCK_ACQUIRED')
      .subscribe((event: LockEventPayload) => {
        if (
          event.resourceId === this.resourceId &&
          event.userId !== this.currentUserId
        ) {
          this.showNotification(`${event.userId} is now editing this resource`);
        }
      });

    this.websocketService
      .on('LOCK_RELEASED')
      .subscribe((event: LockEventPayload) => {
        if (event.resourceId === this.resourceId) {
          this.showNotification(`Resource lock released`);
        }
      });

    this.websocketService
      .on('LOCK_DENIED')
      .subscribe((event: LockEventPayload) => {
        if (event.userId === this.currentUserId) {
          this.showError(`Lock denied: ${event.denialReason}`);
          this.switchToReadOnlyMode();
        }
      });
  }

  ngOnDestroy() {
    this.wsSubscription.unsubscribe();
    this.lockService.releaseLock(ResourceType.SURGERY, this.resourceId);
  }
}
```

---

## 🔄 Step 3: Implement Optimistic Concurrency

### Track Revision Number

```typescript
// models/resource.model.ts
export interface Resource {
  id: string;
  type: ResourceType;
  state: ResourceState;
  revision: number; // Incremented on every update
  content: Record<string, unknown>;
  updatedAt: string;
  updatedBy: string;
}
```

### Send Revision with Updates

```typescript
// services/resource.service.ts
export class ResourceService {
  async updateResource(
    resourceType: ResourceType,
    resourceId: string,
    revision: number,
    changes: Record<string, unknown>,
  ): Promise<UpdateResult> {
    const response = await fetch(
      `/api/resources/${resourceType}/${resourceId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authService.getToken()}`,
        },
        body: JSON.stringify({ revision, changes }),
      },
    );

    const result: UpdateEventPayload = await response.json();

    if (result.conflict) {
      // Conflict detected - another user made changes
      return this.handleConflict(result);
    }

    if (result.success) {
      // Update local revision
      this.localResource.revision = result.newRevision;
      return { success: true, newRevision: result.newRevision };
    }

    return { success: false, errors: result.validationErrors };
  }

  private handleConflict(result: UpdateEventPayload): UpdateResult {
    // Conflict resolution strategies:
    // 1. 'overwrite' - Force local changes (dangerous)
    // 2. 'merge' - Three-way merge (complex)
    // 3. 'reject' - Discard local changes, reload server version (safe default)

    const userChoice = confirm(
      'Another user modified this resource. Reload latest version? (Cancel to keep your changes)',
    );

    if (userChoice) {
      this.reloadResource();
      return { success: false, reloaded: true };
    } else {
      return { success: false, conflict: true };
    }
  }
}
```

### Handle Update Events (WebSocket)

```typescript
// features/surgery-editor/surgery-editor.component.ts
export class SurgeryEditorComponent {
  ngOnInit() {
    this.websocketService
      .on('RESOURCE_UPDATED')
      .subscribe((event: UpdateEventPayload) => {
        if (
          event.resourceId === this.resourceId &&
          event.userId !== this.currentUserId
        ) {
          // Another user updated the resource
          if (event.success) {
            this.localResource.revision = event.newRevision;
            this.mergeRemoteChanges(event.changedFields);
            this.showNotification(`Resource updated by ${event.userId}`);
          }
        }
      });
  }

  private mergeRemoteChanges(changedFields: string[]) {
    // Strategy 1: Reload entire resource (simplest)
    this.reloadResource();

    // Strategy 2: Partial update (preserve local unsaved changes)
    // for (const field of changedFields) {
    //   if (!this.localChanges.has(field)) {
    //     this.localResource[field] = this.remoteResource[field];
    //   }
    // }
  }
}
```

---

## 🚦 Step 4: Handle State Transitions

### Check Allowed Transitions

```typescript
// services/state-transition.service.ts
export class StateTransitionService {
  canTransition(
    resourceConfig: ResourceConfig,
    currentState: ResourceState,
    targetState: ResourceState,
    userRole: UserRole,
  ): { allowed: boolean; reason?: string } {
    const transition = resourceConfig.stateTransitions.find(
      t => t.from === currentState && t.to === targetState,
    );

    if (!transition) {
      return { allowed: false, reason: 'Invalid state transition' };
    }

    if (!transition.allowedRoles.includes(userRole)) {
      return { allowed: false, reason: 'Insufficient permissions' };
    }

    if (transition.requiresUnlock && this.resourceIsLocked()) {
      return { allowed: false, reason: 'Resource must be unlocked first' };
    }

    return { allowed: true };
  }

  async requestStateTransition(
    resourceType: ResourceType,
    resourceId: string,
    targetState: ResourceState,
  ): Promise<StateChangeResult> {
    const response = await fetch(
      `/api/resources/${resourceType}/${resourceId}/state`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authService.getToken()}`,
        },
        body: JSON.stringify({ targetState }),
      },
    );

    const result: StateChangeEventPayload = await response.json();

    if (result.approved) {
      return {
        success: true,
        newState: result.newState,
        newRevision: result.newRevision,
      };
    } else {
      return {
        success: false,
        errors: result.validationErrors,
      };
    }
  }
}
```

### Handle State Change Events

```typescript
// features/surgery-editor/surgery-editor.component.ts
export class SurgeryEditorComponent {
  ngOnInit() {
    this.websocketService
      .on('STATE_CHANGED')
      .subscribe((event: StateChangeEventPayload) => {
        if (event.resourceId === this.resourceId) {
          this.localResource.state = event.newState;
          this.localResource.revision = event.newRevision;

          // Check if new state locks editing
          const config = this.resourceConfigService.getResourceConfig(
            ResourceType.SURGERY,
          );
          if (config.lockedStates.includes(event.newState)) {
            this.disableEditing(`Resource is now ${event.newState}`);
          }

          this.showNotification(
            `State changed: ${event.previousState} → ${event.newState}`,
          );
        }
      });
  }
}
```

---

## 🎨 Step 5: UI Patterns & Best Practices

### Lock Status Indicator

```typescript
// components/lock-status.component.ts
@Component({
  selector: 'app-lock-status',
  template: `
    <div class="lock-status" [ngClass]="statusClass">
      <i class="icon" [ngClass]="iconClass"></i>
      <span>{{ statusText }}</span>
      <button *ngIf="canRequestEdit" (click)="requestLock()">
        Request Edit
      </button>
    </div>
  `,
})
export class LockStatusComponent {
  @Input() lockHolder: string | null;
  @Input() currentUserId: string;
  @Input() resourceState: ResourceState;

  get statusClass(): string {
    if (this.lockHolder === this.currentUserId) return 'editing';
    if (this.lockHolder) return 'locked';
    return 'available';
  }

  get iconClass(): string {
    if (this.lockHolder === this.currentUserId) return 'icon-edit';
    if (this.lockHolder) return 'icon-lock';
    return 'icon-unlock';
  }

  get statusText(): string {
    if (this.lockHolder === this.currentUserId) return 'You are editing';
    if (this.lockHolder) return `Locked by ${this.lockHolder}`;
    return 'Available for editing';
  }

  get canRequestEdit(): boolean {
    return !this.lockHolder && !this.isLockedState(this.resourceState);
  }
}
```

### Revision Conflict Dialog

```typescript
// components/conflict-dialog.component.ts
@Component({
  selector: 'app-conflict-dialog',
  template: `
    <div class="dialog">
      <h2>Conflict Detected</h2>
      <p>Another user modified this resource while you were editing.</p>
      <div class="options">
        <button (click)="reloadServer()">Reload Server Version</button>
        <button (click)="keepLocal()">Keep My Changes</button>
        <button (click)="viewDiff()">View Differences</button>
      </div>
    </div>
  `,
})
export class ConflictDialogComponent {
  @Output() resolution = new EventEmitter<'reload' | 'keep' | 'diff'>();

  reloadServer() {
    this.resolution.emit('reload');
  }

  keepLocal() {
    this.resolution.emit('keep');
  }

  viewDiff() {
    this.resolution.emit('diff');
  }
}
```

### State Transition Button

```typescript
// components/state-transition-button.component.ts
@Component({
  selector: 'app-state-transition',
  template: `
    <button
      [disabled]="!canTransition"
      [title]="transitionReason"
      (click)="requestTransition()"
    >
      {{ buttonText }}
    </button>
  `,
})
export class StateTransitionButtonComponent {
  @Input() currentState: ResourceState;
  @Input() targetState: ResourceState;
  @Input() userRole: UserRole;
  @Input() resourceConfig: ResourceConfig;

  get canTransition(): boolean {
    return this.stateTransitionService.canTransition(
      this.resourceConfig,
      this.currentState,
      this.targetState,
      this.userRole,
    ).allowed;
  }

  get transitionReason(): string {
    const result = this.stateTransitionService.canTransition(
      this.resourceConfig,
      this.currentState,
      this.targetState,
      this.userRole,
    );
    return result.reason || `Transition to ${this.targetState}`;
  }

  get buttonText(): string {
    return `Move to ${this.targetState}`;
  }

  async requestTransition() {
    const result = await this.stateTransitionService.requestStateTransition(
      this.resourceConfig.type,
      this.resourceId,
      this.targetState,
    );

    if (!result.success) {
      this.showErrors(result.errors);
    }
  }
}
```

---

## 📊 Step 6: Testing Guidelines

### Unit Tests (Resource Config Consumer)

```typescript
describe('ResourceConfigService', () => {
  it('should load configurations on init', async () => {
    const configs = await service.loadConfigurations();
    expect(configs[ResourceType.SURGERY]).toBeDefined();
  });

  it('should validate configuration correctness', async () => {
    const config = service.getResourceConfig(ResourceType.SURGERY);
    expect(config.concurrency.maxEditors).toBeGreaterThanOrEqual(0);
    expect(config.subResources.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests (Lock Flow)

```typescript
describe('Lock Flow (Integration)', () => {
  it('should acquire lock when available', async () => {
    const result = await lockService.acquireLock(
      ResourceType.SURGERY,
      'surg-123',
    );
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBeDefined();
  });

  it('should deny lock when already held', async () => {
    await lockService.acquireLock(ResourceType.SURGERY, 'surg-123'); // First user
    const result = await lockService.acquireLock(
      ResourceType.SURGERY,
      'surg-123',
    ); // Second user
    expect(result.success).toBe(false);
    expect(result.reason).toContain('already held');
  });

  it('should release lock on component destroy', async () => {
    await lockService.acquireLock(ResourceType.SURGERY, 'surg-123');
    component.ngOnDestroy();
    // Verify lock released via backend check
  });
});
```

### E2E Tests (State Transitions)

```typescript
describe('State Transition (E2E)', () => {
  it('should allow admin to approve surgery', async () => {
    await login('admin@example.com');
    await navigateTo('/surgery/surg-123');
    await clickButton('Approve');
    expect(await getResourceState()).toBe(ResourceState.APPROVED);
  });

  it('should block editing after approval', async () => {
    await login('surgeon@example.com');
    await navigateTo('/surgery/surg-123');
    expect(await isEditButtonDisabled()).toBe(true);
  });
});
```

---

## 🚨 Common Pitfalls & Solutions

### ❌ Pitfall 1: Forgetting to Release Lock

**Problem**: User closes tab without releasing lock → Resource locked for TTL duration

**Solution**: Use `beforeunload` event + backend 30s grace period

```typescript
window.addEventListener('beforeunload', async event => {
  await this.lockService.releaseLock(this.resourceType, this.resourceId);
});
```

### ❌ Pitfall 2: Not Handling Revision Conflicts

**Problem**: User overwrites another user's changes unknowingly

**Solution**: Always send revision number, handle conflict responses

```typescript
// Always include revision in update requests
const result = await this.resourceService.updateResource(
  this.resourceType,
  this.resourceId,
  this.localResource.revision, // CRITICAL
  this.changes,
);
```

### ❌ Pitfall 3: Ignoring Role Permissions

**Problem**: UI shows edit button to user without permissions → Backend rejects

**Solution**: Check role permissions before showing actions

```typescript
const canEdit = this.resourceConfig.subResources
  .find(sr => sr.type === SubResourceType.MAIN)
  ?.editRoles.includes(this.currentUserRole);

if (!canEdit) {
  this.hideEditButton();
}
```

### ❌ Pitfall 4: Missing Heartbeat

**Problem**: Lock expires while user is actively editing → Changes lost

**Solution**: Implement heartbeat interval from resource config

```typescript
const interval = this.resourceConfig.heartbeatInterval || 60000;
setInterval(() => this.sendHeartbeat(), interval);
```

---

## � Advanced: Custom Resource Schemas

### Registering Custom Resource Types

External APIs can register custom resource schemas at runtime:

```typescript
// Register custom PATIENT resource type
const patientConfig: ResourceConfig = {
  type: ResourceType.PATIENT,
  displayName: 'Patient Record',
  concurrency: { maxEditors: 1, maxViewers: 0 },
  subResources: [
    {
      type: SubResourceType.MAIN,
      displayName: 'Patient Data',
      concurrency: { maxEditors: 1, maxViewers: 0 },
      editRoles: [UserRole.ADMIN, UserRole.SURGEON], // Restricted
      viewRoles: [], // Empty = public view (any authenticated user)
      requiresLock: true,
    },
    {
      type: SubResourceType.COMMENTS,
      displayName: 'Notes',
      concurrency: { maxEditors: 0, maxViewers: 0 },
      editRoles: [], // Empty = public edit (any authenticated user)
      viewRoles: [], // Empty = public view
      requiresLock: false,
      independentLock: true,
    },
  ],
  stateTransitions: [
    {
      from: ResourceState.DRAFT,
      to: ResourceState.APPROVED,
      allowedRoles: [UserRole.ADMIN], // Restricted to admins
    },
    {
      from: ResourceState.APPROVED,
      to: ResourceState.ARCHIVED,
      allowedRoles: [], // Empty = any authenticated user can archive
    },
  ],
  lockedStates: [ResourceState.APPROVED],
  lockTTL: 300000,
  heartbeatInterval: 60000,
};

// Register via API
await fetch('/api/resource-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    config: patientConfig,
    registeredBy: 'external-api-v1',
  }),
});
```

**Public Access Pattern** (empty `allowedRoles[]`):

- **Empty `editRoles[]`** = any authenticated user can edit
- **Empty `viewRoles[]`** = any authenticated user can view
- **Empty `allowedRoles[]` in state transitions** = any authenticated user can trigger transition

**Use cases**:

- Comments/notes sub-resources (multi-user collaboration)
- Public draft → approved workflows
- Read-only resources (empty `editRoles[]` + locked state)

### Validation API (Dry-Run)

```typescript
// Validate config before registering
const validation = await fetch('/api/resource-config/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(myCustomConfig),
});

const result = await validation.json();
if (!result.valid) {
  console.error('Configuration errors:', result.errors);
  // [{ field: 'subResources[0].editRoles', message: 'editRoles must be array' }]
}
```

---

## �📚 Reference

### API Endpoints

| Endpoint                         | Method | Purpose                         |
| -------------------------------- | ------ | ------------------------------- |
| `/health`                        | GET    | Basic health check              |
| `/health/ready`                  | GET    | Readiness check                 |
| `/health/resources`              | GET    | Resource configurations         |
| `/health/capabilities`           | GET    | API capabilities                |
| `/api/resource-config`           | GET    | List registered resource types  |
| `/api/resource-config/:type`     | GET    | Get specific resource config    |
| `/api/resource-config`           | POST   | Register custom resource config |
| `/api/resource-config/validate`  | POST   | Validate config (dry-run)       |
| `/api/resource-config/:type`     | DELETE | Unregister resource config      |
| `/api/resources/lock`            | POST   | Acquire lock                    |
| `/api/resources/lock`            | DELETE | Release lock                    |
| `/api/resources/heartbeat`       | POST   | Renew lock                      |
| `/api/resources/:type/:id`       | GET    | Get resource                    |
| `/api/resources/:type/:id`       | PATCH  | Update resource                 |
| `/api/resources/:type/:id/state` | POST   | Change state                    |

### WebSocket Events

| Event              | Direction    | Payload                   |
| ------------------ | ------------ | ------------------------- |
| `LOCK_ACQUIRED`    | Backend → UI | `LockEventPayload`        |
| `LOCK_RELEASED`    | Backend → UI | `LockEventPayload`        |
| `LOCK_DENIED`      | Backend → UI | `LockEventPayload`        |
| `STATE_CHANGED`    | Backend → UI | `StateChangeEventPayload` |
| `RESOURCE_UPDATED` | Backend → UI | `UpdateEventPayload`      |

**AsyncAPI Specification**: Full WebSocket event schema in `/docs/asyncapi.yaml` (compatible with AsyncAPI 2.6.0 tools)

### Type Definitions

See `/src/websocket-gateway/config/`:

- `resource-config.types.ts` - Resource, sub-resource, state, role enums and interfaces
- `api-contracts.types.ts` - Event payloads, producer/consumer contracts

### Documentation

- **REST API**: Swagger/OpenAPI at `/api/docs` (Swagger UI)
- **WebSocket Events**: AsyncAPI at `/docs/asyncapi.yaml` (use [AsyncAPI Studio](https://studio.asyncapi.com/))
- **Resource Configuration**: Dynamic registry via `/api/resource-config`

---

**Next Steps**:

1. Load resource configurations from `/health/resources`
2. Implement lock acquisition on edit intent
3. Add heartbeat mechanism
4. Handle WebSocket events
5. Implement optimistic concurrency (revision tracking)
6. Test state transitions with role constraints

**Questions?** Check backend logs (`logs/combined-YYYY-MM-DD.log`) or health check endpoints first.
