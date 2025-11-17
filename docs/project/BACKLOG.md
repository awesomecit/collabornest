# Project Backlog

> **Note**| [BE-001.3](#be-0013-distributed-locks-production-blocker) | 🔴 Blocker | Editor locking (data loss prevention) | Critical | High | Week 3-4 | 🟢 98% Done | This file tracks bugs, improvements, and future work discovered during development.
> For Epic/Story/Task planning, see:
>
> - **[ROADMAP.md](./ROADMAP.md)** - Development timeline and milestones
> - **[EPIC-001](./EPIC-001-websocket-gateway.md)** - WebSocket Gateway Implementation
> - \*\*[EPIC-002](./### BE-001.3: Distributed Locks (Production Blocker)

- **Status**: 🟢 **98% COMPLETE** (Week 3, November 17, 2025)
- **Priority**: 🔴 **CRITICAL** (UI Team Blocker - Unblocked ✅)
- **Meeting Date**: November 18, 2025 (25 min)
- **Epic**: [EPIC-001: WebSocket Gateway](./EPIC-001-websocket-gateway.md)
- **Description**: Backend currently allows multiple editors in the same resource with no conflict detection or locking mechanism. High risk of data loss in production healthcare environment.

**Current State**: All lock flows implemented and tested (329/329 tests passing). UI team unblocked with Quick Start guide. Only documentation refinement remaining.2-collaboration-widget.md)\*\* - Collaboration Widget SDK

> - **[EPIC-003](./EPIC-003-production-infra.md)** - Production Infrastructure
>
> For new work, create GitHub Issues using [templates](../../.github/ISSUE_TEMPLATE/).

---

## 📊 Quick Overview

| ID                                                                | Type       | Title                                  | Priority | Difficulty | Due Date | Status      |
| ----------------------------------------------------------------- | ---------- | -------------------------------------- | -------- | ---------- | -------- | ----------- |
| [BUG-001](#bug-001-auto-releasejs-dry-run-modifies-files)         | 🐛 Bug     | auto-release.js dry-run modifies files | Medium   | Easy       | -        | ✅ RESOLVED |
| [DEBT-001](#debt-001-missing-docsproject-structure)               | 🔧 Debt    | Missing /docs/project structure        | Low      | Easy       | Q4 2025  | ✅ RESOLVED |
| [IMPROVE-001](#improve-001-add-changelogmd-generation)            | 💡 Improve | Add CHANGELOG.md generation            | Medium   | Medium     | Q1 2026  | ✅ RESOLVED |
| [IMPROVE-002](#improve-002-cicd-github-actions-activation)        | 💡 Improve | CI/CD GitHub Actions activation        | High     | Easy       | Q1 2026  | ⏸️ Blocked  |
| [FEATURE-001](#feature-001-integration-test-docker-orchestration) | 📋 Feature | Integration test Docker orchestration  | Low      | Medium     | Q2 2026  | 📋 Planned  |
| [FEATURE-002](#feature-002-e2e-test-coverage-reporting)           | 📋 Feature | E2E test coverage reporting            | Low      | Easy       | Q2 2026  | 📋 Planned  |
| [FEATURE-004](#feature-004-websocket-stats-rest-api)              | 📋 Feature | WebSocket stats REST API               | Medium   | Easy       | -        | ✅ RESOLVED |
| [HUSKY-001](#husky-001-husky-v10-compatibility-deprecated-lines)  | 🛠️ Compat  | Husky v10 compatibility                | Low      | Easy       | Q1 2026  | 📋 Open     |
| [INFRA-001](#infra-001-nginx-reverse-proxy-configuration)         | 🏗️ Infra   | Nginx reverse-proxy for WebSocket      | High     | Medium     | Q4 2025  | 📋 Planned  |
| [INFRA-002](#infra-002-redis-adapter-multi-instance-scaling)      | 🏗️ Infra   | Redis adapter for horizontal scaling   | Medium   | Medium     | Q1 2026  | 📋 Planned  |
| [FEATURE-003](#feature-003-connection-leak-detection-sweep-job)   | 📋 Feature | Automatic stale connection cleanup     | Medium   | Easy       | Q1 2026  | 📋 Planned  |
| [BE-001.3](#be-0013-distributed-locks-production-blocker)         | 🔴 Blocker | Editor locking (data loss prevention)  | Critical | High       | Week 3-4 | � 95% Done  |
| [DEBT-002](#debt-002-standardize-error-handling-architecture)     | 🔧 Debt    | Standardize error handling             | Medium   | Medium     | Q1 2026  | 📋 Open     |
| [FEATURE-005](#feature-005-audit-trail-structured-logging)        | 📋 Feature | Audit trail & Elastic/OpenSearch       | High     | Medium     | Q2 2026  | 📋 Planned  |
| [FEATURE-006](#feature-006-asyncapi-schema-generation)            | 📋 Feature | AsyncAPI schema auto-generation        | Low      | Easy       | Q2 2026  | 📋 Planned  |

**Legend**:

- Status: ✅ Resolved | 🔄 In Progress | 📋 Planned | ⏸️ Blocked | 📝 Open
- Priority: Critical | High | Medium | Low
- Difficulty: Easy | Medium | Hard

---

## 🐛 Bugs

### BUG-001: auto-release.js dry-run modifies files

- **Status**: ✅ **RESOLVED** (v0.2.0)
- **Priority**: Medium
- **Discovered**: 2025-11-15
- **Resolved**: 2025-11-15
- **Description**: Running `npm run release:suggest` (with `--dry-run` flag) actually modifies `package.json` and `package-lock.json` instead of just previewing changes.
- **Root Cause**: Missing `--dry-run` flag propagation to version-calculator.js in auto-release.js line 376
- **Fix Applied**: Added `--dry-run` flag to execCommand when calling version-calculator.js
- **Verification**: MD5 checksums of package.json and package-lock.json remain identical before/after dry-run execution
- **Commit**: Included in v0.2.0 release (commit cb50cba)

## 🔧 Technical Debt

### DEBT-001: Missing /docs/project structure

- **Status**: ✅ **RESOLVED** (v0.2.1)
- **Priority**: Low
- **Resolved**: 2025-11-16
- **Description**: Project lacked formal documentation structure per copilot-instructions
- **Solution Implemented**:
  - Created `/docs/project/ROADMAP.md` - Development timeline
  - Created `/docs/project/EPIC-001-websocket-gateway.md` - Backend Epic
  - Created `/docs/project/EPIC-002-collaboration-widget.md` - Frontend Epic
  - Created `/docs/project/EPIC-003-production-infra.md` - DevOps Epic
  - Created `.github/ISSUE_TEMPLATE/` - Bug report, feature request, task templates
  - Updated `CONTRIBUTING.md` with "How to Pick a Task" section
  - Updated `README.md` with badges and project navigation
- **Commit**: Included in v0.2.1+ release

---

### DEBT-002: Standardize error handling architecture

- **Status**: 📋 **OPEN**
- **Priority**: Medium
- **Difficulty**: Medium
- **Target**: Q1 2026
- **Discovered**: 2025-11-17
- **Description**: Codebase lacks unified error handling strategy - inconsistent patterns across modules
- **Current State Analysis**:
  - **NestJS exceptions**: `NotFoundException`, `BadRequestException` used in controllers (correct)
  - **Generic Error**: `new Error()` used in services and utils (inconsistent)
  - **No custom exceptions**: Business logic errors not semantically typed
  - **ValidationError**: Buried in DTO validator service (not reusable)
  - **No error codes**: Frontend can't distinguish error types programmatically
- **Problems**:
  - Frontend cannot distinguish "Resource not found" vs "Lock denied" without parsing messages
  - Logs lack structured error classification (debugging difficult)
  - No consistent error response schema across APIs
  - Difficult to internationalize error messages (hardcoded strings)
- **Proposed Solution**: Implement standardized exception hierarchy

  ```typescript
  // src/common/exceptions/base.exception.ts
  export abstract class AppException extends Error {
    constructor(
      public readonly code: string,
      public readonly message: string,
      public readonly statusCode: number,
      public readonly metadata?: Record<string, unknown>,
    ) {
      super(message);
    }
  }

  // Business domain exceptions
  export class ResourceNotFoundException extends AppException {
    constructor(resourceType: string, resourceId: string) {
      super(
        'RESOURCE_NOT_FOUND',
        `${resourceType} '${resourceId}' not found`,
        404,
        { resourceType, resourceId },
      );
    }
  }

  export class LockDeniedException extends AppException {
    constructor(resourceId: string, lockHolderId: string) {
      super('LOCK_DENIED', `Resource locked by user ${lockHolderId}`, 409, {
        resourceId,
        lockHolderId,
      });
    }
  }

  export class ValidationException extends AppException {
    constructor(errors: ValidationError[]) {
      super('VALIDATION_FAILED', 'Input validation failed', 400, { errors });
    }
  }
  ```

- **Error Response Schema** (RFC 7807-inspired):

  ```json
  {
    "code": "LOCK_DENIED",
    "message": "Resource locked by user surgeon-123",
    "statusCode": 409,
    "timestamp": "2025-11-17T15:30:00Z",
    "path": "/api/resources/surgery/surg-456/lock",
    "metadata": {
      "resourceId": "surg-456",
      "lockHolderId": "surgeon-123",
      "expiresAt": "2025-11-17T15:35:00Z"
    }
  }
  ```

- **Implementation Plan**:
  1. **Phase 1 (Q1 2026)**: Create exception hierarchy in `src/common/exceptions/`
     - [ ] `AppException` base class
     - [ ] Domain exceptions: `ResourceNotFoundException`, `LockDeniedException`, `ValidationException`
     - [ ] Exception filter to transform exceptions to standard response schema
     - [ ] Error code enum/constants (SSOT)
  2. **Phase 2 (Q1 2026)**: Migrate existing code
     - [ ] Replace `throw new Error()` with custom exceptions in services
     - [ ] Update controllers to use domain exceptions
     - [ ] Add error code mapping to frontend TypeScript types
  3. **Phase 3 (Q2 2026)**: Advanced features
     - [ ] Internationalization (i18n) for error messages
     - [ ] Sentry/error tracking integration
     - [ ] Error analytics dashboard
- **Deliverables**:
  - [ ] `src/common/exceptions/` module with base + domain exceptions
  - [ ] Updated `AllExceptionsFilter` to handle custom exceptions
  - [ ] Error code constants exported for frontend consumption
  - [ ] Migration guide in `docs/CONTRIBUTING.md`
  - [ ] Unit tests for exception hierarchy (100% coverage)
- **Acceptance Criteria**:
  - [ ] All business logic errors use custom exceptions (zero `throw new Error()`)
  - [ ] Error responses follow RFC 7807 schema
  - [ ] Frontend can programmatically handle errors via `code` field
  - [ ] Logs include structured error metadata
  - [ ] Error handling documented in API docs (Swagger)
- **References**:
  - [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
  - [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807)
  - Current filter: `src/common/filters/all-exceptions.filter.ts`

---

## 💡 Improvements

### IMPROVE-001: Add CHANGELOG.md generation

- **Status**: ✅ **RESOLVED** (v0.2.0)
- **Priority**: Medium
- **Resolved**: 2025-11-15
- **Description**: auto-release.js referenced changelog generation but CHANGELOG.md didn't exist
- **Solution Implemented**:
  - Created `CHANGELOG.md` following Keep a Changelog format
  - Added manual changelog update process in release workflow
  - Documented in CONTRIBUTING.md
- **Commit**: Included in v0.2.0 release
- **Note**: Automatic generation via conventional-changelog deferred to Q1 2026

---

### IMPROVE-002: CI/CD GitHub Actions activation

- **Status**: Blocked (no GitHub credits)
- **Priority**: High (when unblocked)
- **Description**: Workflows exist as .bak templates but not active
- **Files**:
  - `.github/workflows/ci.yml.bak`
  - `.github/workflows/release.yml.bak`
- **Next Steps**:
  - Rename .bak → .yml when GitHub credits available
  - Test workflows in CI environment
  - Verify test suite runs in GitHub Actions

## 📋 Future Features

### FEATURE-001: Integration test Docker orchestration

- **Status**: Not Started
- **Priority**: Low
- **Description**: Improve test:integration:safe with better Docker health checks
- **Details**: Current implementation checks container, could add connection pooling validation

### FEATURE-002: E2E test coverage reporting

- **Status**: Not Started
- **Priority**: Low
- **Description**: E2E tests don't generate coverage reports (by design, but could be optional)

---

### FEATURE-003: Connection leak detection sweep job

- **Status**: Planned
- **Priority**: Medium
- **Difficulty**: Easy
- **Target**: Q1 2026 (BE-001.2 Presence Tracking)
- **Description**: Implement automatic sweep job to detect and cleanup stale WebSocket connections

---

### FEATURE-004: WebSocket Stats REST API

- **Status**: ✅ **COMPLETED** (v0.2.2)
- **Priority**: Medium
- **Difficulty**: Easy
- **Resolved**: 2025-11-17
- **Description**: REST endpoint to expose WebSocket connection pool statistics for UI monitoring
- **Implementation**:
  - `GET /api/v1/api/websocket/stats` - Returns totalConnections, uniqueUsers, byTransport, staleConnections
  - Public endpoint (no JWT required) - aggregate stats only, no sensitive data
  - Controller: `WebSocketStatsController` with 3 unit tests (all passing)
  - Documented in `UI_TEAM_WEBSOCKET_API.md` with React example
- **Use Case**: UI dashboard to show "Users Online" counter and transport breakdown
- **Rate Limit**: UI should poll max 1 req/5s (not enforced backend, guideline only)
- **Commit**: Included in v0.2.2+ release
- **Reference**: `src/websocket-gateway/websocket-stats.controller.ts`
- **Rationale**: Prevent memory leaks from orphaned connections (network issues, crashed clients, etc.)
- **Current Implementation**:
  - `cleanupStaleConnections()` method exists (lines 547-585 in websocket-gateway.gateway.ts)
  - Tracks `lastActivityAt` per connection
  - Stale threshold: 2x pingTimeout (default 40s)
  - Manual invocation only (no automatic sweep)
- **Required Implementation**:
  - Add `setInterval()` in `afterInit()` for periodic sweep
  - Configurable sweep interval (default: 60s, like reference implementation)
  - Prometheus metrics: `websocket_stale_connections_total`, `websocket_cleanup_duration_seconds`
  - Graceful shutdown: Clear interval in `onApplicationShutdown()`
  - Log sweep statistics when stale connections found
- **Deliverables**:
  - [ ] Config option: `getSweepInterval()` in `WebSocketGatewayConfigService`
  - [ ] Interval timer in `afterInit()` calling `cleanupStaleConnections()`
  - [ ] Prometheus metrics for monitoring
  - [ ] Unit tests: Verify sweep job runs periodically
  - [ ] Integration test: Verify stale connection cleanup with mocked time
  - [ ] Documentation: Update EPIC-001 with sweep job details
- **Acceptance Criteria**:
  - [ ] Sweep job runs every 60s (configurable)
  - [ ] Stale connections disconnected and removed from pool
  - [ ] Metrics exported for alerting (Grafana dashboard)
  - [ ] Zero performance impact on active connections
  - [ ] Graceful shutdown clears interval timer
- **Configuration Example**:

  ```typescript
  // config/gateway-config.service.ts
  getSweepInterval(): number {
    return this.config.sweepInterval || 60000; // 60s default
  }

  // websocket-gateway.gateway.ts
  afterInit(server: Server): void {
    this.sweepJobTimer = setInterval(() => {
      const cleanedCount = this.cleanupStaleConnections();
      if (cleanedCount > 0) {
        this.logger.warn(`Sweep job cleaned ${cleanedCount} stale connections`);
      }
    }, this.config.getSweepInterval());
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.sweepJobTimer) {
      clearInterval(this.sweepJobTimer);
    }
    await this.gracefulShutdown();
  }
  ```

- **References**:
  - `reference/gatawey-old/socket-gateway/socket-gateway.gateway.ts` lines 3160-3164 (sweep job pattern)
  - Current implementation: `src/websocket-gateway/websocket-gateway.gateway.ts` lines 547-585
  - EPIC-001: BE-001.2 Presence Tracking (related feature)

---

## 🏗️ Infrastructure

### INFRA-001: Nginx reverse-proxy configuration

- **Status**: Planned
- **Priority**: High
- **Difficulty**: Medium
- **Target**: Q4 2025
- **Description**: Configure Nginx as reverse-proxy for production WebSocket deployment
- **Documentation**: `docs/infrastructure/NGINX_SOCKETIO_GUIDE.md`
- **Requirements**:
  - WebSocket upgrade headers configuration
  - Long-lived connection timeout settings (7d proxy_read_timeout)
  - Sticky sessions for polling fallback (ip_hash or Redis)
  - CORS headers for cross-origin polling
  - SSL/TLS termination with wss:// support
  - Custom logging format for WebSocket debugging
- **Deliverables**:
  - [ ] Production-ready `nginx.conf` template
  - [ ] SSL certificate automation (Let's Encrypt)
  - [ ] Health check endpoints configuration
  - [ ] Monitoring integration (Prometheus/Grafana)
  - [ ] Deployment runbook in `docs/infrastructure/`
- **Acceptance Criteria**:
  - [ ] WebSocket connections upgrade successfully
  - [ ] Polling fallback works with sticky sessions
  - [ ] Zero-downtime deployments supported
  - [ ] Connection metrics exported to monitoring
  - [ ] Load testing validates 1000+ concurrent connections
- **References**:
  - [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
  - `docs/infrastructure/NGINX_SOCKETIO_GUIDE.md` - Complete configuration guide

---

### INFRA-002: Redis adapter multi-instance scaling

- **Status**: Planned
- **Priority**: Medium
- **Difficulty**: Medium
- **Target**: Q1 2026
- **Description**: Implement Redis adapter for horizontal scaling across multiple backend instances
- **Rationale**: Required for load balancing and high availability without sticky sessions
- **Dependencies**: INFRA-001 (Nginx configuration)
- **Implementation**:
  - Socket.IO Redis adapter (`@socket.io/redis-adapter`)
  - Redis Pub/Sub for cross-instance messaging
  - Connection state synchronization
  - Lock manager Redis backend (replace in-memory Map)
- **Deliverables**:
  - [ ] `RedisIoAdapter` class extending `IoAdapter`
  - [ ] Redis connection health checks
  - [ ] Failover strategy (Redis Sentinel or Cluster)
  - [ ] Migration guide from single-instance to multi-instance
  - [ ] Performance benchmarks (latency impact)
- **Acceptance Criteria**:
  - [ ] Events broadcast across all instances
  - [ ] Lock state synchronized via Redis
  - [ ] Graceful degradation on Redis failure
  - [ ] <5ms latency overhead for broadcast
  - [ ] Horizontal scaling verified (3+ instances)
- **Configuration Example**:

  ```typescript
  // src/websocket-gateway/redis-io.adapter.ts
  export class RedisIoAdapter extends IoAdapter {
    async connectToRedis(): Promise<void> {
      const pubClient = createClient({ url: 'redis://localhost:6379' });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
    }
  }
  ```

- **References**:
  - [Socket.IO Redis Adapter Docs](https://socket.io/docs/v4/redis-adapter/)
  - `docs/infrastructure/NGINX_SOCKETIO_GUIDE.md` - Section "Long Polling - Soluzione 2: Redis Adapter"

---

## 🎯 Epic References

> **Note**: Epic details have been moved to dedicated files for better organization.

### Active Epics

- **[BE-001: WebSocket Gateway Implementation](./EPIC-001-websocket-gateway.md)** - Status: 🔄 In Progress (Weeks 1-8)
- **[FE-001: Collaboration Widget SDK](./EPIC-002-collaboration-widget.md)** - Status: 📋 Planned (Weeks 9-13)
- **[DEVOPS-001: Production Infrastructure](./EPIC-003-production-infra.md)** - Status: 📋 Planned (Weeks 14-16)

For detailed user stories, acceptance criteria, and BDD scenarios, see individual Epic files.

For timeline and milestones, see **[ROADMAP.md](./ROADMAP.md)**.

---

## 🎯 Roadmap Items (Future)

> **Note**: Detailed quarterly roadmap with timeline is in **[ROADMAP.md](./ROADMAP.md)**

### Q1 2026

- [ ] ~~Add CHANGELOG.md generation (IMPROVE-001)~~ ✅ Completed in v0.2.0
- [ ] Activate CI/CD GitHub Actions (IMPROVE-002) - Blocked: no GitHub credits
- [ ] Husky v10 migration (HUSKY-001)
- [ ] Security scanning integration (Snyk, Dependabot)

### Q2 2026

- [ ] Advanced lock strategies (Redlock multi-instance)
- [ ] Analytics dashboard for collaboration metrics
- [ ] FHIR/HL7 integration examples
- [ ] Mobile SDK (React Native)

### Q3 2026

- [ ] Video/audio collaboration layer
- [ ] Advanced conflict resolution UI
- [ ] Multi-tenancy support
- [ ] Enterprise SSO integration

### Q4 2026

- [ ] AI-powered collaboration suggestions
- [ ] Historical playback of collaboration sessions
- [ ] Advanced analytics and reporting
- [ ] Compliance certifications (HIPAA, SOC 2)

---

## 🛠️ Compatibility / Deprecations

### HUSKY-001: Husky v10 compatibility (DEPRECATED lines)

- **Status**: Open
- **Priority**: Low
- **Discovered**: 2025-11-15
- **Description**: Older Husky hook scripts often include the following two lines at the top of hook files:

  ```sh
  #!/usr/bin/env sh
  . "$(dirname -- "$0")/_/husky.sh"
  ```

- **Problem**: These lines will fail under Husky v10.0.0 and newer in certain environments. The project should remove them from hook files that rely on the new Husky behaviour.
- **Files Affected**: `.husky/commit-msg` (and possibly other hooks copied from older templates)
- **Recommended Change**:
  - Remove the two lines shown above from the top of `.husky/commit-msg` and other hook files.
  - Ensure hook scripts remain executable and call tools (like `npx --no-install commitlint`) directly.
  - Prefer the modern Husky installation/setup method documented by the Husky project.
- **Acceptance Criteria**:
  - [ ] `.husky/commit-msg` no longer contains the deprecated shebang and souring lines
  - [ ] Hooks still execute correctly on developers' machines
  - [ ] Add a short note in `CONTRIBUTING.md` about Husky version expectations
- **Workaround**: If a developer has an older environment, use a local script wrapper or pin Husky to a compatible version in the local environment (not recommended long-term).

- [ ] Performance benchmarking baseline

---

**Last Updated**: November 16, 2025
**Maintained By**: Development Team

---

---

## 🔴 Critical Blockers (Production)

### BE-001.3: Distributed Locks (Production Blocker)

- **Status**: � **NEARLY COMPLETE** (Week 3, November 18-25, 2025)
- **Priority**: 🔴 **CRITICAL** (UI Team Blocker - Unblocked ✅)
- **Meeting Date**: November 18, 2025 (25 min)
- **Epic**: [EPIC-001: WebSocket Gateway](./EPIC-001-websocket-gateway.md)
- **Description**: Backend currently allows multiple editors in the same resource with no conflict detection or locking mechanism. High risk of data loss in production healthcare environment.

#### Meeting Decisions (Nov 18, 2025) ✅

**Approach**: YAGNI-driven - ship simplest working solution Week 3, defer complexity to backlog

**Approved Decisions**:

1. **Lock Upgrade Flow**: Option A (Deny) - Toast "Locked by [User]", stay viewer
2. **Disconnect Handling**: Option B (30s grace period) - Reconnect preserves lock
3. **Tabs Per User**: Option C (Single tab only) - Simplest enforcement
4. **Admin Override**: Option B (No override) - Feature not requested (YAGNI)
5. **Lock TTL**: Option B (5 minutes) - Survives distractions, doesn't block too long
6. **Viewer Limits**: Option A (No limit) - WebSocket handles 100+ easily
7. **Heartbeat**: Option B (60s interval) - 5 heartbeats before expiry
8. **Backward Compat**: Option C (Warn + Kill fast) - 2-week migration, remove Week 5

**Configuration**:

```env
LOCK_TTL=300                # 5 minutes
LOCK_HEARTBEAT_INTERVAL=60  # 60 seconds
LOCK_GRACE_PERIOD=30        # 30 seconds
LOCK_SINGLE_TAB=true
```

#### Week 3 Deliverables (Nov 18-25)

- [x] **RedisLockService TDD Green** (2 days) ✅ Nov 17
  - `acquireLock()`, `releaseLock()`, `extendLock()`, `getLockHolder()` ✅
  - Single tab enforcement: Check `userHasActiveLock()` ✅
  - Backward compat: Auto-convert `doc:123` → `doc:123:main` + deprecation log ✅

- [x] **WebSocket Lock Events** (1 day) ✅ Nov 17
  - `lock_acquired`, `lock_released`, `lock_denied` ✅
  - Disconnect handler with 30s grace period ✅
  - **Enhancement**: Error response dual identifiers (`code` + `type`)
  - **Enhancement**: Custom TTL support (min 5s, default 300s)

- [x] **BDD Test Suite** (1 day) ✅ Nov 17
  - 7 scenarios passing (6 planned + Scenario 4 TTL expiry)
  - All Redis lock flows validated (atomic SETNX, Lua script ownership)

- [ ] **API Documentation** (0.5 day) - In Progress
  - Update `UI_TEAM_WEBSOCKET_API.md` with events contract
  - Document error.type field (human-readable frontend switch/case)

#### Future Backlog (NOT Week 3)

Create tickets ONLY if real problem emerges:

| Feature           | Trigger                       | Priority |
| ----------------- | ----------------------------- | -------- |
| Lock Queue        | Users complain about denials  | P2       |
| Multi-Tab Support | Dual-monitor workflow needed  | P3       |
| Admin Override    | Emergency scenario documented | P2       |
| Viewer Limits     | Performance >50 viewers       | P3       |

#### Timeline

- **Week 3 (Nov 18-22)**: Implementation + BDD tests
- **Week 3 Demo (Nov 25)**: Lock flow working ✅
- **Week 4 (Nov 25-29)**: Frontend migration to explicit resourceId format
- **Week 5 (Dec 2)**: Remove backward compat code (clean codebase)

#### Success Metrics

**Functional**:

- Single editor enforced ✅
- Lock TTL 5 min ✅
- Heartbeat 60s ✅
- Disconnect 30s grace ✅
- Toast "Locked by [User]" ✅
- Backward compat with warnings ✅

**Performance**:

- Lock acquire: <50ms
- Heartbeat: <10KB/min per user
- Disconnect detection: 30s ±5s

**Coverage**:

- 6 BDD scenarios: 100%
- Unit tests: >90%

#### References

- Meeting outcome: `docs/project/BE-001.3-MEETING-OUTCOME.md`
- Epic: `docs/project/EPIC-001-websocket-gateway.md` (BE-001.3)
- Redis schema: `lock:{resourceType}:{id}:{section}` → `userId` (TTL 300s)

---

### BE-001.5: Redis Presence Persistence (Multi-Instance Foundation)

**Status**: 📋 **PLANNED** (Week 4, November 18-25, 2025)
**Priority**: 🟡 **HIGH** (Enables Production Multi-Pod Deployment)
**Epic**: [EPIC-001: WebSocket Gateway](./EPIC-001-websocket-gateway.md)
**Description**: Current presence tracking uses in-memory Map (single-instance only). Migrate to Redis to enable horizontal scaling and multi-pod coordination.

#### Problem

```typescript
// ❌ CURRENT: In-memory (single-instance limitation)
private connectedClients = new Map<string, Socket>();
private userPresence = new Map<string, { userId, documentId, rooms }>();
// Cannot share state across multiple gateway instances
```

#### Solution Architecture

**Redis Key Patterns**:

```redis
# User presence (TTL 5 min, auto-cleanup on disconnect)
presence:user:{userId} → { socketId, lastSeen, rooms: [] }

# Room membership (TTL 10 min, extended on activity)
presence:room:{roomId} → Set(userId1, userId2, ...)

# Socket metadata (TTL 5 min, cleanup on disconnect)
presence:socket:{socketId} → { userId, connectedAt, lastActivity }
```

**New Service**:

```typescript
@Injectable()
export class RedisPresenceService {
  async setUserPresence(userId: string, data: PresenceData): Promise<void>;
  async removeUserPresence(userId: string): Promise<void>;
  async getRoomMembers(roomId: string): Promise<string[]>;
  async getUserPresence(userId: string): Promise<PresenceData | null>;
  async addUserToRoom(userId: string, roomId: string): Promise<void>;
  async removeUserFromRoom(userId: string, roomId: string): Promise<void>;
}
```

#### Deliverables

- [ ] `RedisPresenceService` implementation with unit tests
- [ ] Gateway migration: `Map` → `RedisPresenceService`
- [ ] Backward compatibility: graceful fallback to in-memory if Redis down (circuit breaker prep)
- [ ] BDD tests: 2 gateway instances, 1 Redis, verify cross-instance presence sync
- [ ] Performance benchmark: <10ms p99 for presence operations

#### Success Metrics

- Multi-instance deployment working (2+ gateway pods share presence state)
- Lock events propagate across instances (User A in Pod 1 sees User B's lock from Pod 2)
- Zero data loss on pod restart (presence persisted in Redis)
- Graceful degradation (Redis down → single-instance in-memory mode)

#### Timeline

- **Effort**: 4-6 hours
- **Target**: Week 4 (November 18-25, 2025)

---

### BE-001.7: Circuit Breakers & Resilience (Production Stability)

**Status**: 📋 **PLANNED** (Week 4, November 18-25, 2025)
**Priority**: 🟡 **HIGH** (Prevents Cascade Failures in Production)
**Epic**: [EPIC-001: WebSocket Gateway](./EPIC-001-websocket-gateway.md)
**Description**: Implement circuit breaker pattern for Redis/PostgreSQL failures. Prevent cascade failures, enable graceful degradation.

#### Problem

- Redis/PostgreSQL failures block entire gateway (no fallback)
- Cascading failures crash all pods (no isolation)
- No health check endpoint (Kubernetes cannot detect unhealthy pods)

#### Solution Architecture

**Circuit Breaker Pattern**:

```typescript
enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN,
}

@Injectable()
export class CircuitBreakerService {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private threshold = 5; // 5 consecutive failures → OPEN
  private timeout = 30000; // 30s before HALF_OPEN retry

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      throw new CircuitOpenError('Service unavailable, using fallback');
    }
    try {
      const result = await fn();
      this.onSuccess(); // Reset failures, CLOSED state
      return result;
    } catch (error) {
      this.onFailure(); // Increment failures, maybe → OPEN
      throw error;
    }
  }
}
```

**Graceful Degradation**:

- **Redis down**: Fallback to in-memory Map (single-instance mode, limited features)
- **PostgreSQL down**: Skip audit logs, continue serving WebSocket connections
- **RabbitMQ down**: Direct client messaging (no cross-instance broadcast)

**Health Check Endpoint**:

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'unhealthy',
  redis: { connected: true, latency: 2 },
  postgres: { connected: true, latency: 5 },
  rabbitmq: { connected: false, error: 'Connection refused' }
}
```

#### Deliverables

- [ ] `CircuitBreakerService` with configurable thresholds
- [ ] Wrap Redis calls with circuit breaker (RedisLockService, RedisPresenceService)
- [ ] Health check endpoint `/health` with dependency status
- [ ] Graceful degradation tests: kill Redis → verify in-memory fallback
- [ ] Exponential backoff retry logic (1s, 2s, 4s, 8s, max 30s)

#### Success Metrics

- Redis failure does NOT crash gateway (fallback to in-memory)
- Health check responds in <50ms
- Circuit breaker opens after 5 failures (prevents spam)
- Automatic recovery when service restored (HALF_OPEN → CLOSED)

#### Timeline

- **Effort**: 3-4 hours
- **Target**: Week 4 (November 18-25, 2025)
- **Dependency**: After BE-001.5 (Redis Presence)

---

### NEW: External API Integration (WebHook Receiver)

**Status**: 📋 **PLANNED** (Week 5, November 25-29, 2025)
**Priority**: 🔴 **CRITICAL** (Core Product Feature - External System Push Notifications)
**Epic**: NEW - Cross-System Real-Time Sync
**Description**: Enable external systems (EMR, PACS, HL7 feeds) to push resource updates via HTTP webhook. Broadcast updates to WebSocket clients in real-time (no polling).

#### Problem

**Current State**: UI polls REST API every 5-30s for resource updates (inefficient, latency)

**Target State**: External system → POST webhook → WebSocket broadcast → UI updates instantly

#### Solution Architecture

**Webhook Controller**:

```typescript
// POST /api/webhooks/resource-updated
interface WebhookPayload {
  resourceType: 'document' | 'operationReport' | 'patient';
  resourceId: string; // "doc:123", "patient:456"
  action: 'created' | 'updated' | 'deleted' | 'signed';
  data: any; // Full resource payload or partial diff
  timestamp: string; // ISO 8601
  source: string; // 'EMR', 'PACS', 'HL7_FEED'
  signature: string; // HMAC-SHA256 for validation
}

@Controller('webhooks')
export class WebhookController {
  @Post('resource-updated')
  async handleResourceUpdate(@Body() payload: WebhookPayload) {
    // 1. Validate HMAC signature (prevent spoofing)
    this.validateSignature(payload);

    // 2. Query Redis: which users are subscribed to this resource?
    const room = `resource:${payload.resourceType}:${payload.resourceId}`;
    const members = await this.presenceService.getRoomMembers(room);

    // 3. Broadcast to WebSocket clients
    this.wsGateway.server.to(room).emit('RESOURCE_UPDATED', {
      resourceId: payload.resourceId,
      action: payload.action,
      data: payload.data,
      timestamp: payload.timestamp,
      source: payload.source,
    });

    return { status: 'broadcasted', recipients: members.length };
  }
}
```

**Complete Flow**:

```
External System (EMR/PACS)
  → POST /api/webhooks/resource-updated
    { resourceId: "doc:123", action: "updated", data: {...}, signature: "hmac..." }
      → WebhookController validates HMAC signature
        → Query Redis: getRoomMembers("resource:doc:123")
          → Gateway broadcasts WebSocket event to all clients in room
            → UI clients receive RESOURCE_UPDATED, update DOM
              → Zero polling, instant updates
```

#### Security

- **HMAC Signature**: Shared secret with external system (WEBHOOK_SECRET env var)
- **Rate Limiting**: Max 100 req/min per source IP (prevent DDoS)
- **IP Whitelist**: Only allow known external system IPs
- **JWT Option**: Alternative to HMAC for authenticated webhooks

#### Deliverables

- [ ] `WebhookController` with POST `/api/webhooks/resource-updated`
- [ ] HMAC signature validation (`validateSignature()` method)
- [ ] Gateway `broadcastToRoom()` helper method
- [ ] Rate limiting middleware (100 req/min per source)
- [ ] E2E test: simulate external POST → verify WebSocket clients receive event
- [ ] Documentation: External System Integration Guide (setup HMAC, webhook URL, payload format)

#### Success Metrics

- Webhook → WebSocket broadcast in <100ms p99
- HMAC validation prevents spoofed requests (security test)
- Rate limiting blocks spam (>100 req/min rejected)
- Zero polling on UI side (event-driven updates only)

#### Timeline

- **Effort**: 6-8 hours
- **Target**: Week 5 (November 25-29, 2025)
- **Dependency**: After BE-001.5 (Redis Presence) and BE-001.7 (Circuit Breakers)

---

### FEATURE-005: Audit Trail & Structured Logging

**Status**: 📋 Planned | **Target**: Q2 2026 | **Priority**: High | **Effort**: Medium

**Context**: BE-001.6 (EPIC-001) definisce audit trail per WebSocket Gateway. Estendere a sistema enterprise-grade con Elastic Stack.

**Problem**:

- Nessun audit trail implementato (BE-001.6 planned Week 6-7, non in codebase)
- Assenza di structured logging per troubleshooting
- Nessuna integrazione Elastic/OpenSearch/Kibana per query avanzate

**Specification Reference** (EPIC-001.md lines 391-410):

- **Format**: NDJSON (Newline-Delimited JSON)
- **Storage**: PostgreSQL (10-year retention)
- **Events**: connect, join, lock, edit, disconnect
- **Indexed Columns**: userId, resourceId, eventType, timestamp
- **GDPR**: Compliant with data retention policies

**Proposed Solution**:

1. **Implement AuditService** (BE-001.6 baseline):
   - NDJSON format for machine-readable logs
   - PostgreSQL storage with indexed queries
   - Event types: WebSocket (connect, join, lock, edit, disconnect), REST API (CRUD), Auth (login, logout)
   - Metadata: userId, resourceId, eventType, timestamp, ip, userAgent, correlationId

2. **Integrate Winston** (structured logging):
   - Replace console.log with Winston logger
   - Log levels: error, warn, info, debug, trace
   - Transports: console (dev), file (prod), Elasticsearch (optional)
   - Correlation IDs for request tracing

3. **Elastic Stack Integration**:
   - Filebeat/Logstash ingestion pipeline
   - OpenSearch/Elasticsearch indexing (index-per-month pattern)
   - Kibana dashboards: user activity, error rates, lock contention, WebSocket connections
   - Retention policy: 3 months hot, 2 years warm, archive to cold storage

4. **Query API** (optional):
   - GET /api/audit?userId=X&startDate=Y&endDate=Z
   - Filter by eventType, resourceId, correlationId
   - Pagination, CSV export

**Acceptance Criteria**:

- [ ] AuditService implemented with PostgreSQL storage
- [ ] All WebSocket events logged (connect, join, lock, edit, disconnect)
- [ ] All REST API operations logged (CRUD, auth)
- [ ] Winston integrated with structured logging
- [ ] Correlation IDs in all logs
- [ ] Filebeat/Logstash configuration documented
- [ ] Kibana dashboard templates provided
- [ ] Query API for audit trail access
- [ ] GDPR-compliant data retention (10 years)
- [ ] Performance: <5ms p99 latency for audit writes

**Timeline**:

- Week 1-2: AuditService baseline (BE-001.6)
- Week 3-4: Winston integration + correlation IDs
- Week 5-6: Elastic Stack setup + Filebeat
- Week 7-8: Kibana dashboards + Query API
- Week 9: Testing + documentation

**Dependencies**:

- BE-001.6 (EPIC-001) specification
- PostgreSQL database (already in use)
- Docker Compose for Elastic Stack (local dev)

**References**:

- EPIC-001.md (BE-001.6: Audit Trail, lines 391-410)
- [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html)
- [Winston Transport Docs](https://github.com/winstonjs/winston#transports)

---

### FEATURE-006: AsyncAPI Schema Generation

**Status**: 📋 Planned | **Target**: Q2 2026 | **Priority**: Low | **Effort**: Easy

**Context**: WebSocket events documented manually in EPIC-001, BDD tests, and UI guide. AsyncAPI standard provides machine-readable schema for auto-generating client SDKs, testing tools, and interactive documentation.

**Problem**:

- WebSocket events scattered across multiple docs (EPIC-001, BDD_TEST_COVERAGE, UI_INTEGRATION_GUIDE)
- No single source of truth for event contracts
- Manual maintenance when events change
- No type-safe client SDK generation
- No AsyncAPI Studio integration for interactive docs

**Proposed Solution**:

1. **Generate AsyncAPI 3.0 Schema from Code**:
   - Annotate event handlers with decorators: `@AsyncApiEvent()`, `@AsyncApiPayload()`
   - Runtime reflection to extract event names, payloads, descriptions
   - Output: `docs/asyncapi.yaml` (auto-generated on build)

2. **AsyncAPI Decorators** (example):

   ```typescript
   @AsyncApiEvent({
     channel: 'resource:joined',
     description: 'Emitted when user successfully joins a resource',
     message: JoinResourceResponseDto,
   })
   async handleJoinResource(@MessageBody() payload: JoinResourceDto) {
     // ...
   }
   ```

3. **Build Integration**:
   - `npm run asyncapi:generate` - Generates `docs/asyncapi.yaml`
   - Pre-commit hook validates schema
   - CI/CD publishes to AsyncAPI Studio

4. **Deliverables**:
   - [ ] AsyncAPI decorator library (`@nestjs-asyncapi/decorators`)
   - [ ] Schema generator script (`scripts/generate-asyncapi.js`)
   - [ ] CI/CD integration (validate + publish)
   - [ ] AsyncAPI Studio link in README
   - [ ] Auto-generate TypeScript client SDK (optional)

**Acceptance Criteria**:

- [ ] All WebSocket events documented in `asyncapi.yaml`
- [ ] Schema auto-generated from NestJS decorators
- [ ] CI validates schema on every commit
- [ ] AsyncAPI Studio URL in README (https://studio.asyncapi.com/)
- [ ] Deprecation warnings for removed events
- [ ] Versioned schemas (v1, v2) for breaking changes

**Benefits**:

- Single source of truth (code = docs)
- Auto-generate client SDKs (TypeScript, Python, Java)
- Interactive documentation (AsyncAPI Studio)
- Contract testing (validate payloads against schema)
- Deprecation tracking (breaking changes audit)

**Timeline**: 2-3 days (1 day decorators, 1 day generator, 1 day CI/docs)

**Dependencies**: None (pure documentation automation)

**References**:

- [AsyncAPI Specification](https://www.asyncapi.com/docs/reference/specification/v3.0.0)
- [AsyncAPI Studio](https://studio.asyncapi.com/)
- [NestJS Microservices Decorators](https://docs.nestjs.com/microservices/basics) (pattern reference)

---

## 📝 How to Use This File

**For Bugs/Issues**: Create GitHub Issue using [bug report template](../../.github/ISSUE_TEMPLATE/bug_report.md)

**For Features**: Create GitHub Issue using [feature request template](../../.github/ISSUE_TEMPLATE/feature_request.md)

**For Tasks**: Create GitHub Issue using [task template](../../.github/ISSUE_TEMPLATE/task.md)

**For Epic Planning**: See dedicated Epic files (EPIC-001.md, EPIC-002.md, EPIC-003.md)

**For Timeline**: See [ROADMAP.md](./ROADMAP.md)
