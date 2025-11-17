# CollaborNest — Real-Time Collaboration System for Healthcare

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build Status](https://img.shields.io/github/actions/workflow/status/antoniocittadino/collabornest/ci.yml?branch=main)](https://github.com/antoniocittadino/collabornest/actions)
[![Issues](https://img.shields.io/github/issues/antoniocittadino/collabornest)](<https://github.com/antoniocittad--->

## 📄 License

**CollaborNest** is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](./LICENSE).

### What This Means

- ✅ **Free for self-hosting**: Use, modify, and deploy on your own infrastructure
- ✅ **Open source contributions**: Fork, modify, and contribute back to the community
- ⚠️ **SaaS requirement**: If you offer CollaborNest as a service (SaaS), you must open-source your modifications
- 💼 **Commercial license available**: Need to use CollaborNest without AGPL obligations? Contact us for a commercial license

**Why AGPL-3.0?**

We chose AGPL-3.0 to ensure that improvements to CollaborNest remain open-source when used in hosted services, while allowing commercial licensing for businesses that prefer proprietary solutions.

**Commercial Licensing**: Starting at **$2,500/year** for SaaS providers and enterprises. Contact [antonio.cittadino@collabornest.io](mailto:antonio.cittadino@collabornest.io?subject=Commercial%20License%20Inquiry) for pricing and terms.

📄 **[View Commercial License Details](./LICENSE-COMMERCIAL.md)** | **[Pricing Tiers & FAQ](./LICENSE-COMMERCIAL.md#pricing-tiers)**

### Dependencies License Compatibility

All dependencies use permissive licenses (MIT, BSD, Apache-2.0) that are compatible with AGPL-3.0:

- **NestJS**: MIT
- **Socket.IO**: MIT
- **ioredis**: MIT
- **TypeORM**: MIT
- **Winston**: MIT
- **PostgreSQL**: PostgreSQL License (BSD-like)

See [LICENSE](./LICENSE) for full terms.ollabornest/issues)
[![Good First Issues](https://img.shields.io/github/issues/antoniocittadino/collabornest/good%20first%20issue?color=7057ff)](https://github.com/antoniocittadino/collabornest/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

**CollaborNest** is an open-source real-time collaboration platform designed for healthcare applications. Transform any web application into a collaborative system with **zero code changes** using our JavaScript widget.

> **📜 License**: AGPL-3.0 (commercial licenses available for SaaS/closed-source usage)

> **Status**: 🚧 Active Development | **Version**: 0.2.1 | **Target**: Production Q2 2026

---

## 📚 Documentation

> **🗺️ New here?** See **[Documentation Structure Guide](./docs/DOCUMENTATION_GUIDE.md)** to understand where everything is!

- **[Quickstart Guide](./docs/QUICKSTART.md)** - 15-minute tutorial to get started
- **[Documentation Guide](./docs/DOCUMENTATION_GUIDE.md)** - 📍 **START HERE** - Complete navigation of all docs
- **[Project Roadmap](./docs/project/ROADMAP.md)** - Development timeline and milestones
- **[Complete Specification](./docs/PROJECT.md)** - Full technical architecture (2000+ lines)
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project
- **[Security Policy](./SECURITY.md)** - Vulnerability reporting and security practices

---

## ✨ Features

- ✅ **Google Docs-style Editing** - Real-time CRDT-based collaboration with Y.js
- ✅ **Distributed Locking** - Prevent conflicts on critical resources with Redis-backed locks
- ✅ **Real-time Presence** - See who's editing what, live user cursors and status
- ✅ **Offline-First** - Automatic synchronization when connection restores
- ✅ **GDPR-Compliant Audit Trail** - Complete event logging with 10-year retention
- ✅ **Zero Integration Effort** - Add 2 lines of HTML, no app code changes required
- ✅ **Scalable Architecture** - Supports 500+ concurrent users with horizontal scaling

## 🎯 Quick Start

> **New here?** Check out our [📖 Quickstart Guide](./docs/QUICKSTART.md) for a step-by-step tutorial (15 minutes).

### Prerequisites

Before starting, ensure you have:

- **Node.js** >= 20.8.0 ([Download](https://nodejs.org/))
- **npm** >= 10.0.0 (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **Docker** (optional, for database tests) ([Download](https://www.docker.com/get-started))

```bash
# Verify versions
node -v   # Should be >= v20.8.0
npm -v    # Should be >= 10.0.0
```

### Installation (Widget Integration)

Add CollaborNest to your existing healthcare app with 2 lines of code:

```html
<!-- Add to your existing healthcare app -->
<script src="https://cdn.collabornest.io/widget/v1/collab.min.js"></script>
<script>
  CollaborNest.init({
    apiKey: 'your-api-key',
    userId: 'user-123',
    resourceId: 'page:/patient/12345',
  });
</script>
```

That's it! Your application now supports real-time collaboration.

### Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/collabornest.git
cd collabornest

# 2. Install dependencies
npm install

# 3. Verify setup (format, lint, test, build)
npm run verify

# 4. Start development server (optional)
npm run start:dev

# 5. Run tests
npm test                        # Unit tests (fast, no DB)
npm run test:integration:safe   # Integration tests (requires Docker)
npm run test:e2e:safe          # E2E tests (requires Docker)
```

### Start Database (for Integration Tests)

```bash
# Start PostgreSQL, Redis, RabbitMQ
docker-compose up -d

# Check containers are running
docker-compose ps

# Stop when done
docker-compose down
```

## 📋 Project Roadmap

For detailed project plan, see [`docs/PROJECT.md`](./PROJECT.md) and [`docs/project/BACKLOG.md`](./docs/project/BACKLOG.md).

### Phase 1: Foundation (Weeks 1-8) ✅ In Progress

- [x] Backend architecture design
- [x] WebSocket Gateway with Socket.IO
- [ ] Y.js CRDT integration
- [ ] Redis distributed locks
- [ ] PostgreSQL audit logging

### Phase 2: Frontend Widget (Weeks 9-13)

- [ ] JavaScript SDK development
- [ ] Auto-discovery of input fields
- [ ] Real-time presence UI
- [ ] Offline synchronization

### Phase 3: Production Ready (Weeks 14-16)

- [ ] Load testing (500+ users)
- [ ] Blue-Green deployment
- [ ] Monitoring with Prometheus/Grafana
- [ ] Complete documentation

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Existing Healthcare App                   │
│                     (NO CODE CHANGES)                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ Load Widget (2 lines)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              CollaborNest Widget (JavaScript)                │
│  • Auto-detects input fields  • Real-time presence UI       │
│  • Y.js CRDT engine          • Offline sync queue           │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (WSS)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                WebSocket Gateway (NestJS)                    │
│  • Socket.IO server          • JWT authentication           │
│  • Y.js awareness protocol   • Presence tracking            │
└─────┬─────────────┬─────────────┬────────────────┬──────────┘
      │             │             │                │
      ▼             ▼             ▼                ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│  Redis   │  │RabbitMQ  │  │PostgreSQL│  │ Prometheus   │
│ Sessions │  │ Events   │  │  Audit   │  │   Metrics    │
│  Locks   │  │ Pub/Sub  │  │   Logs   │  │   & Alerts   │
└──────────┘  └──────────┘  └──────────┘  └──────────────┘
```

## 🚀 Key Performance Metrics

| Metric               | Target      | Status      |
| -------------------- | ----------- | ----------- |
| Latency P99          | < 200ms     | ⚙️ Testing  |
| Uptime               | > 99.5%     | 📊 Baseline |
| Max Concurrent Users | 500+        | 🎯 Target   |
| Message Delivery     | > 99.9%     | ⚙️ Testing  |
| Widget Load Time     | < 500ms     | ✅ Achieved |
| Time to Integration  | < 5 minutes | ✅ Achieved |

## 📚 Documentation

- **[Quickstart Guide](./docs/QUICKSTART.md)** - Get started in 15 minutes (new developers start here!)
- **[Complete Project Specification](./docs/PROJECT.md)** - Full architecture and BDD scenarios
- **[Contributing Guide](./CONTRIBUTING.md)** - Development workflow, git hooks, testing strategy
- **[Project Backlog](./docs/project/BACKLOG.md)** - Current tasks and priorities
- **[API Documentation](./docs/API.md)** - WebSocket events and REST endpoints _(coming soon)_
- **[Architecture Deep Dive](./docs/ARCHITECTURE.md)** - System design decisions _(coming soon)_

## 🏥 Healthcare-Specific Features

- **HIPAA/GDPR Compliance** - Encrypted connections, complete audit trail
- **FHIR/HL7 Integration** - Seamless interoperability with healthcare systems
- **Role-Based Access** - Surgeon, Nurse, Admin permission models
- **Optimistic Locking** - Prevent conflicting updates in surgical workflows
- **10-Year Audit Retention** - Legal compliance for medical records

## 🛠️ Technology Stack

**Backend**: NestJS, Socket.IO, Y.js, TypeORM
**Infrastructure**: Redis, RabbitMQ, PostgreSQL
**Monitoring**: Prometheus, Grafana, NDJSON logging
**Frontend**: Vanilla JS (framework-agnostic), Y.js
**Testing**: Jest, Testcontainers, Artillery (load tests)

## 📦 Repository Structure

```
collabornest/
├── src/                       # Source code (NestJS application)
│   ├── common/                # Shared utilities (logger, filters, interceptors)
│   │   ├── constants/         # Error messages, constants
│   │   ├── controllers/       # Wildcard controller
│   │   ├── database/          # Database module
│   │   ├── entities/          # Base entities with audit fields
│   │   ├── filters/           # Exception filters
│   │   ├── interceptors/      # Response transform, logging
│   │   ├── logger/            # Winston logger service
│   │   ├── middleware/        # Security middleware (Helmet)
│   │   ├── timezone/          # Timezone management
│   │   ├── utils/             # Utilities (case converter, DB helpers)
│   │   └── validators/        # DTO validators
│   ├── config/                # Configuration and env validation (Joi)
│   ├── health/                # Health check endpoints (/health, /health/db)
│   ├── swagger/               # Swagger API documentation
│   ├── app.module.ts          # Root application module
│   └── main.ts                # Application entry point
│
├── test/                      # Tests
│   ├── *.e2e.spec.ts          # E2E tests (full stack)
│   ├── *.integration.spec.ts  # Integration tests (database)
│   └── globalSetup/Teardown   # Test environment setup
│
├── scripts/                   # Automation scripts
│   ├── auto-release.js        # Automatic versioning and releases
│   ├── analyze-complexity.js  # Code complexity analysis
│   ├── test-env-guard.sh      # Safe test execution (Docker check)
│   ├── prepare-copilot-context.sh  # AI context preparation
│   └── end-of-day-debrief.sh  # Session debrief generator
│
├── docs/                      # Documentation
│   ├── QUICKSTART.md          # 15-minute getting started guide
│   ├── PROJECT.md             # Complete project specification
│   ├── STRONG_TYPING_VIOLATIONS_REPORT.md  # Type safety audit
│   └── project/               # Project management
│       └── BACKLOG.md         # Tasks, bugs, epics
│
├── .husky/                    # Git hooks (pre-commit, commit-msg)
├── .github/                   # GitHub configuration
│   ├── copilot-instructions.md  # AI agent instructions
│   └── workflows/             # CI/CD workflows (disabled, .bak files)
│
├── package.json               # Dependencies and npm scripts
├── tsconfig.json              # TypeScript configuration
├── jest.config.js             # Jest configuration (unit tests)
├── jest.integration.config.js # Integration tests configuration
├── jest.e2e.config.js         # E2E tests configuration
├── eslint.config.mjs          # ESLint rules
├── docker-compose.yml         # PostgreSQL for development
├── .env.example               # Environment variables template
│
├── README.md                  # This file
├── CONTRIBUTING.md            # Contribution guidelines
├── CODE_OF_CONDUCT.md         # Community guidelines
└── LICENSE                    # MIT License
```

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for the complete workflow.

**Quick Contributing Checklist**:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run verification: `npm run verify`
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat(scope): description"`
6. Push and create a Pull Request

**Current Needs**:

- [ ] Frontend widget developers (TypeScript/Vanilla JS)
- [ ] Load testing scenarios (Artillery)
- [ ] Documentation improvements
- [ ] Healthcare domain expertise (FHIR/HL7)
- [ ] Code reviews and feedback

### Available NPM Scripts

**Development**:

```bash
npm run start          # Start application
npm run start:dev      # Start with hot reload (watch mode)
npm run start:debug    # Start with debugger
npm run start:prod     # Start production build
```

**Testing**:

```bash
npm test                        # Run unit tests
npm run test:watch              # Run tests in watch mode (TDD)
npm run test:cov                # Run tests with coverage
npm run test:coverage           # Generate coverage report
npm run test:coverage:check     # Check coverage (CI mode)
npm run test:tdd                # TDD mode (watch + coverage + verbose)
npm run test:debug              # Run tests with debugger
npm run test:e2e                # Run E2E tests (requires DB)
npm run test:e2e:safe          # Run E2E with Docker check
npm run test:integration        # Run integration tests (requires DB)
npm run test:integration:safe  # Run integration with Docker check
```

**Code Quality**:

```bash
npm run lint                # Lint and auto-fix
npm run lint:check          # Lint without fixing
npm run format              # Format code with Prettier
npm run format:check        # Check formatting without changes
npm run quality             # Run format:check + lint:check
npm run quality:fix         # Run format + lint (auto-fix all)
```

**Complexity Analysis**:

```bash
npm run analyze              # Full complexity analysis
npm run analyze:cognitive    # Cognitive complexity only
npm run analyze:cyclomatic   # Cyclomatic complexity only
npm run analyze:functions    # Function-level analysis
npm run analyze:security     # Security issues detection
npm run analyze:json         # Output as JSON
npm run analyze:report       # Generate JSON report in reports/
```

**Build & Verification**:

```bash
npm run build              # Build TypeScript to dist/
npm run verify             # Run format:check + lint:check + test + build
npm run verify:full        # Run verify + test:coverage:check
npm run ci                 # Same as verify:full (for CI/CD)
```

**Release Management**:

```bash
npm run release             # Auto-detect version bump and release
npm run release:suggest     # Preview release (dry-run)
npm run release:dry         # Same as release:suggest
npm run release:patch       # Force patch version (0.0.X)
npm run release:minor       # Force minor version (0.X.0)
npm run release:major       # Force major version (X.0.0)
```

**Git Hooks** (automatically run):

```bash
npm run prepare            # Setup Husky git hooks
npm run pre-commit         # Run lint-staged (on git commit)
```

> **Note**: See [QUICKSTART.md](./docs/QUICKSTART.md) for detailed explanations of each script.

## 🔒 Security

We take security seriously. CollaborNest includes built-in protections and follows security best practices.

### Reporting Vulnerabilities

Report security vulnerabilities **privately** to: <awesome.cit.dev@gmail.com>

**DO NOT** create public GitHub issues for security concerns.

See [SECURITY.md](./SECURITY.md) for our full security policy and vulnerability disclosure process.

### Security Scripts

```bash
npm run security:check       # Scan for exposed secrets in code
npm run security:scan        # Run npm audit (dependency vulnerabilities)
npm run verify:security      # Full security verification (tests + scans)
```

### Built-in Security Features

- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Rate Limiting** - 100 req/min per IP (configurable)
- ✅ **Helmet.js** - Security headers (CSP, HSTS, XSS protection)
- ✅ **Input Validation** - class-validator on all endpoints
- ✅ **SQL Injection Prevention** - TypeORM parameterized queries
- ✅ **Secret Scanning** - Pre-commit hooks prevent credential leaks
- ✅ **Audit Logging** - Complete event trail (NDJSON format)
- ✅ **HIPAA/GDPR Compliance** - Healthcare data protection standards

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Quick Start for Contributors

1. **Find a Task**: Browse [open issues](https://github.com/your-org/collabornest/issues) with `good first issue` or `help wanted` labels
2. **Read the Epic**: Understand context in `/docs/project/EPIC-XXX.md`
3. **Check Roadmap**: See [ROADMAP.md](./docs/project/ROADMAP.md) for current priorities
4. **Follow Workflow**: Read [CONTRIBUTING.md](./CONTRIBUTING.md) for development process

### Current Priorities (November 2025)

| Epic                                                      | Description                      | Status         | Help Wanted         |
| --------------------------------------------------------- | -------------------------------- | -------------- | ------------------- |
| [BE-001](./docs/project/EPIC-001-websocket-gateway.md)    | WebSocket Gateway Implementation | 🔄 In Progress | Backend developers  |
| [FE-001](./docs/project/EPIC-002-collaboration-widget.md) | Collaboration Widget SDK         | 📋 Planned     | Frontend developers |
| [DEVOPS-001](./docs/project/EPIC-003-production-infra.md) | Production Infrastructure        | � Planned      | DevOps engineers    |

### Good First Issues

Perfect for first-time contributors:

- [Browse good first issues](https://github.com/your-org/collabornest/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- [Browse help wanted issues](https://github.com/your-org/collabornest/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)

### Development Workflow

```bash
# 1. Fork and clone
git clone https://github.com/your-username/collabornest.git

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Make changes following TDD
npm run test:watch

# 4. Verify quality
npm run verify

# 5. Commit with conventional commits
git commit -m "feat(component): add feature description"

# 6. Push and create PR
git push -u origin feature/your-feature
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on:

- Commit message conventions
- Testing requirements
- Code quality standards
- Pull request process
- How to pick a task (GitHub Issues → Epic → Story → Task)

---

## 📚 Project Navigation

### For Users

- **[Quickstart Guide](./docs/QUICKSTART.md)** - Get up and running in 15 minutes
- **[Complete Specification](./docs/PROJECT.md)** - Full technical architecture with BDD scenarios and diagrams

### For Contributors

- **[Roadmap](./docs/project/ROADMAP.md)** - Development timeline and milestones
- **[Backlog](./docs/project/BACKLOG.md)** - Current bugs, improvements, and planned work
- **[Epic 001: WebSocket Gateway](./docs/project/EPIC-001-websocket-gateway.md)** - Backend collaboration engine
- **[Epic 002: Widget SDK](./docs/project/EPIC-002-collaboration-widget.md)** - Frontend integration widget
- **[Epic 003: Infrastructure](./docs/project/EPIC-003-production-infra.md)** - DevOps and deployment
- **[Contributing Guide](./CONTRIBUTING.md)** - Development workflow and task selection

### For Maintainers

- **[Security Policy](./SECURITY.md)** - Vulnerability reporting and security practices
- **[Code of Conduct](./CODE_OF_CONDUCT.md)** - Community guidelines
- **[Changelog](./CHANGELOG.md)** - Version history and release notes

---

## �📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ for Healthcare Collaboration**
**Maintainer**: Antonio (<awesome.cit.dev@gmail.com>)
**Last Updated**: November 16, 2025
