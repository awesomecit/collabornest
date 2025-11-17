# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Next Steps

- **Week 3-4 (December 2025)**: Distributed Locks implementation (Redis-backed, < 5ms latency)
- **Week 5-6**: Redis Streams for multi-instance broadcasting
- **Week 7-8**: Y.js CRDT integration for conflict-free editing

## [0.3.0] - 2025-11-17

### Added

- **WebSocket Presence Tracking** (BE-001.2): Multi-tab awareness and real-time user notifications
  - `resource:all_users` event: See all users across all tabs of a parent resource
  - `user:joined` / `user:left` events: Real-time presence updates
  - Editor/Viewer mode support (lock enforcement planned for Week 3-4)
  - BDD test suite: 8/8 scenarios passing (100% coverage)
- **Robust Event Handling Infrastructure**:
  - `test-config.js`: Centralized timeout and retry configuration
  - `event-helpers.js`: Race condition prevention, timeout handling, promise-based event waiting
  - `debug-scenario8.test.js`: Isolated test runner with detailed logging
- **UI Integration Guide** (`docs/UI_INTEGRATION_GUIDE.md`): Quick reference for frontend team
  - 5-minute setup guide
  - Multi-tab presence examples (tested in Scenario 8)
  - Race condition prevention patterns
  - Production readiness checklist
- **Scenario 8 BDD Test**: Multi-user, multi-tab presence tracking
  - Tests: Alice, Bob, Charlie in 3 different tabs of same document
  - Validates: `resource:all_users` cross-tab awareness
  - Validates: `resource:joined` scoped to current tab only

### Fixed

- **Race condition in BDD tests**: Listeners now registered BEFORE emit (prevents timeout/pending state)
- **Callback-style emit**: Replaced with `emitAndWait()` helper for atomic operations
- **Hardcoded timeouts**: Replaced with `TEST_CONFIG.events.*` (default: 3s, slow: 10s, critical: 15s)
- **Double listener bug**: Removed duplicate `waitForEvent()` + `emitAndWait()` calls
- **Scenario 8 timeout**: Now passes consistently (Alice/Bob/Charlie all receive `resource:all_users`)

### Changed

- **BDD test suite refactored**: All scenarios use robust event helpers
- **Connection helper**: Uses centralized `TEST_CONFIG` instead of magic numbers
- **Join/Leave helpers**: Replaced callback-based with promise-based `emitAndWait()`

### Documentation

- Updated `UI_INTEGRATION_GUIDE.md`: Concise, actionable guide for UI team (no fluff)
- Clarified multi-tab presence tracking (answers UI developer question)
- Added distributed locks roadmap (Week 3-4, critical for production editor mode)

## [0.2.1] - 2025-11-16

### Fixed

- ESLint configuration moved to root directory for proper detection
- ESLint parsing errors in test files resolved
- Scripts directory now properly linted

### Changed

- Applied Prettier formatting to `scripts/check-secrets.js`
- Applied Prettier formatting to `docs/KNOWN_VULNERABILITIES.md`
- Cleaned up trailing whitespaces and blank lines

## [0.2.0] - 2025-11-16

### Added

- Complete security policy with vulnerability reporting process (SECURITY.md)
- Secret scanning script (scripts/check-secrets.js) with pre-commit integration
- Environment configuration template (.env.template) for safe setup
- Comprehensive project specification (docs/PROJECT.md - 2194 lines)
- Quick start guide (docs/QUICKSTART.md) for 15-minute onboarding
- Development infrastructure with Husky git hooks (pre-commit, commit-msg, pre-push)
- Testing framework: Jest with 112 unit tests
- Integration tests with Testcontainers (PostgreSQL)
- E2E tests with Docker safe guards
- Auto-release system with semantic versioning
- Complexity analysis and code quality scripts
- Healthcare compliance documentation (HIPAA/GDPR guidelines)
- Security features: JWT auth, rate limiting, Helmet.js, audit logging
- 41 npm scripts across 7 categories (Development, Testing, Quality, Analysis, Build, Release, Security)
- Project history tracking (docs/HISTORY.md)

### Fixed

- BUG-001: auto-release.js dry-run no longer modifies files

### Security

- Zero sensitive data in repository (verified with automated scanning)
- All environment variables properly configured
- 0 critical/high vulnerabilities in dependencies
- 2 moderate vulnerabilities (js-yaml in @nestjs/swagger - documentation only, acceptable risk)

### Documentation

- Archived temporary security reports to docs/archive/2025-11-16-security-audit/
- Consolidated documentation from 24 to 18 markdown files
- Moved HOOK_CONFIGURATION_GUIDE.md content to CONTRIBUTING.md
- Organized documentation following open source best practices

## [0.1.0] - 2025-11-15

### Added

- Initial NestJS project setup
- Basic health check endpoints
- Database module with TypeORM
- Winston logging service
- Basic security middleware

---

[Unreleased]: https://github.com/yourusername/collabornest/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/yourusername/collabornest/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourusername/collabornest/releases/tag/v0.1.0
