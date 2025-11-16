# Project Backlog

> **Note**: This file tracks bugs, improvements, and future work discovered during development.
> Items here should eventually move to GitHub Issues or be converted to TASK-XXX.md files.

## 📊 Quick Overview

| ID | Type | Title | Priority | Difficulty | Due Date | Status |
|----|------|-------|----------|------------|----------|--------|
| [BUG-001](#bug-001-auto-releasejs-dry-run-modifies-files) | 🐛 Bug | auto-release.js dry-run modifies files | Medium | Easy | - | ✅ RESOLVED |
| [DEBT-001](#debt-001-missing-docsproject-structure) | 🔧 Debt | Missing /docs/project structure | Low | Easy | Q4 2025 | 🔄 In Progress |
| [IMPROVE-001](#improve-001-add-changelogmd-generation) | 💡 Improve | Add CHANGELOG.md generation | Medium | Medium | Q1 2026 | 📋 Planned |
| [IMPROVE-002](#improve-002-cicd-github-actions-activation) | 💡 Improve | CI/CD GitHub Actions activation | High | Easy | Q1 2026 | ⏸️ Blocked |
| [FEATURE-001](#feature-001-integration-test-docker-orchestration) | 📋 Feature | Integration test Docker orchestration | Low | Medium | Q2 2026 | 📋 Planned |
| [FEATURE-002](#feature-002-e2e-test-coverage-reporting) | 📋 Feature | E2E test coverage reporting | Low | Easy | Q2 2026 | 📋 Planned |
| [HUSKY-001](#husky-001-husky-v10-compatibility-deprecated-lines) | 🛠️ Compat | Husky v10 compatibility | Low | Easy | Q1 2026 | 📋 Open |
| [BE-001](#be-001-websocket-gateway-implementation) | 🚀 Epic | WebSocket Gateway Implementation | Critical | High | Week 8 | 🔄 In Progress |
| [FE-001](#fe-001-collaboration-widget-sdk) | 🚀 Epic | Collaboration Widget SDK | High | High | Week 13 | 📋 Planned |
| [DEVOPS-001](#devops-001-production-infrastructure) | 🚀 Epic | Production Infrastructure | High | Medium | Week 16 | 📋 Planned |

**Legend**:

- Status: ✅ Resolved | 🔄 In Progress | 📋 Planned | ⏸️ Blocked | 📝 Open
- Priority: Critical | High | Medium | Low
- Difficulty: Easy | Medium | Hard

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

- **Status**: In Progress
- **Priority**: Low
- **Description**: Project lacks formal documentation structure per copilot-instructions
- **Required Structure**:

  ```text
  /docs/
  ├── dev/           # .gitignored, agent session notes
  └── project/       # Version controlled
      ├── ROADMAP.md
      ├── BACKLOG.md (this file)
      ├── EPIC-XXX.md
      ├── STORY-XXX.md
      └── TASK-XXX.md
  ```

## 💡 Improvements

### IMPROVE-001: Add CHANGELOG.md generation

- **Status**: Not Started
- **Priority**: Medium
- **Description**: auto-release.js references changelog generation but CHANGELOG.md doesn't exist
- **Details**:
  - Script says "Would execute: npm run release:changelog"
  - No `release:changelog` script in package.json
  - Need conventional-changelog integration
- **Acceptance Criteria**:
  - [ ] Add CHANGELOG.md template
  - [ ] Create `release:changelog` script
  - [ ] Integrate with auto-release.js
  - [ ] Follow Keep a Changelog format

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

## 🎯 Major Epics (From PROJECT.md)

### BE-001: WebSocket Gateway Implementation

- **Status**: 🔄 In Progress
- **Priority**: Critical
- **Difficulty**: High
- **Timeline**: Weeks 1-8 (Started)
- **Team**: 2 backend developers
- **Description**: Core WebSocket Gateway with Y.js CRDT, presence tracking, distributed locks, and audit logging.

**User Stories**:

- [ ] BE-001.1: WebSocket Connection Management (Week 1-2)
- [ ] BE-001.2: Presence Tracking & Resource Rooms (Week 2-3)
- [ ] BE-001.3: Distributed Lock Management (Week 3-4)
- [ ] BE-001.4: Y.js CRDT Integration (Week 4-6)
- [ ] BE-001.5: RabbitMQ Event Broadcasting (Week 5-6)
- [ ] BE-001.6: PostgreSQL Audit Logging (Week 6-7)
- [ ] BE-001.7: Error Handling & Recovery (Week 7-8)
- [ ] BE-001.8: Performance Optimization & Load Testing (Week 8)

**Success Criteria**:

- [ ] WebSocket connection with JWT auth
- [ ] Real-time presence tracking (join/leave events)
- [ ] Redis-backed distributed locks (< 5ms latency)
- [ ] Y.js document synchronization
- [ ] RabbitMQ event broadcasting
- [ ] NDJSON audit logs with 10-year retention
- [ ] Load test: 500+ concurrent users with < 200ms P99 latency

---

### FE-001: Collaboration Widget SDK

- **Status**: 📋 Planned
- **Priority**: High
- **Difficulty**: High
- **Timeline**: Weeks 9-13
- **Team**: 1 frontend developer
- **Description**: JavaScript widget for zero-code integration with existing healthcare apps.

**User Stories**:

- [ ] FE-001.1: Widget Auto-Discovery & Initialization (Week 9-10)
- [ ] FE-001.2: Real-time Collaboration UI (Week 10-11)
- [ ] FE-001.3: Offline Support & Queue Management (Week 11-12)
- [ ] FE-001.4: CDN Distribution & Versioning (Week 12-13)
- [ ] FE-001.5: Integration Testing & Documentation (Week 13)

**Success Criteria**:

- [ ] < 2 lines of code integration
- [ ] Auto-detect input fields (text, textarea, contenteditable)
- [ ] Real-time presence UI (avatars, cursors)
- [ ] Offline editing with sync queue
- [ ] Widget bundle < 150KB gzipped
- [ ] CDN deployment with semver
- [ ] Example apps (React, Vue, Angular, Vanilla JS)

---

### DEVOPS-001: Production Infrastructure

- **Status**: 📋 Planned
- **Priority**: High
- **Difficulty**: Medium
- **Timeline**: Weeks 14-16
- **Team**: 1 DevOps engineer + 1 backend developer
- **Description**: Production-ready infrastructure with monitoring, CI/CD, and disaster recovery.

**Tasks**:

- [ ] DEVOPS-001.1: Terraform Infrastructure as Code (Week 14)
- [ ] DEVOPS-001.2: Blue-Green Deployment Pipeline (Week 14)
- [ ] DEVOPS-001.3: Prometheus + Grafana Monitoring (Week 15)
- [ ] DEVOPS-001.4: Load Testing with Artillery (Week 15)
- [ ] DEVOPS-001.5: Disaster Recovery Plan & Backups (Week 16)
- [ ] DEVOPS-001.6: Security Hardening & SSL (Week 16)

**Success Criteria**:

- [ ] Terraform scripts for AWS/GCP deployment
- [ ] CI/CD with GitHub Actions (test → build → deploy)
- [ ] Blue-Green deployment with zero downtime
- [ ] Monitoring dashboards (latency, errors, throughput)
- [ ] Load test: 1000+ concurrent users
- [ ] Automated backups (PostgreSQL daily, Redis snapshots)
- [ ] Security audit passed (SSL, HIPAA compliance)

---

## 🎯 Roadmap Items (Future)

### Q1 2026

- [ ] Add CHANGELOG.md generation (IMPROVE-001)
- [ ] Activate CI/CD GitHub Actions (IMPROVE-002)
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

**Last Updated**: 2025-11-15
**Maintained By**: Development Team
