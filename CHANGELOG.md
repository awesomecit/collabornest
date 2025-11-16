# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
