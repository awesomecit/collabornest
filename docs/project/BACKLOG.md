# Project Backlog

> **Note**: This file tracks bugs, improvements, and future work discovered during development.
> For Epic/Story/Task planning, see:
>
> - **[ROADMAP.md](./ROADMAP.md)** - Development timeline and milestones
> - **[EPIC-001](./EPIC-001-websocket-gateway.md)** - WebSocket Gateway Implementation
> - **[EPIC-002](./EPIC-002-collaboration-widget.md)** - Collaboration Widget SDK
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
| [HUSKY-001](#husky-001-husky-v10-compatibility-deprecated-lines)  | 🛠️ Compat  | Husky v10 compatibility                | Low      | Easy       | Q1 2026  | 📋 Open     |
| [INFRA-001](#infra-001-nginx-reverse-proxy-configuration)         | 🏗️ Infra   | Nginx reverse-proxy for WebSocket      | High     | Medium     | Q4 2025  | 📋 Planned  |
| [INFRA-002](#infra-002-redis-adapter-multi-instance-scaling)      | 🏗️ Infra   | Redis adapter for horizontal scaling   | Medium   | Medium     | Q1 2026  | 📋 Planned  |

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

## 📝 How to Use This File

**For Bugs/Issues**: Create GitHub Issue using [bug report template](../../.github/ISSUE_TEMPLATE/bug_report.md)

**For Features**: Create GitHub Issue using [feature request template](../../.github/ISSUE_TEMPLATE/feature_request.md)

**For Tasks**: Create GitHub Issue using [task template](../../.github/ISSUE_TEMPLATE/task.md)

**For Epic Planning**: See dedicated Epic files (EPIC-001.md, EPIC-002.md, EPIC-003.md)

**For Timeline**: See [ROADMAP.md](./ROADMAP.md)
