# Contributing to NestJS Template Generator

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Conventions](#commit-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Code Quality Standards](#code-quality-standards)
- [Pull Request Process](#pull-request-process)
- [Release Workflow](#release-workflow)
- [Git Hooks](#git-hooks)
- [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- **Node.js**: >= 20.8.0
- **npm**: >= 10.0.0
- **Docker**: For running PostgreSQL (optional for unit tests)
- **Git**: For version control

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd collabornest
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Verify setup**

   ```bash
   npm run verify
   ```

   This runs: `format:check` → `lint:check` → `test` → `build`

5. **Start development server** (optional)

   ```bash
   npm run start:dev
   ```

## Development Workflow

We follow **Trunk-Based Development (TBD)** with **Extreme Programming (XP)** practices:

### Daily Workflow

```bash
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Create short-lived feature branch (max 1-2 days)
git checkout -b feature/add-user-validation

# 3. Make atomic changes (one logical change per commit)
# ... edit code ...

# 4. Run tests frequently (TDD approach)
npm test

# 5. Commit following conventional commits
git add .
git commit -m "feat(users): add email validation to user entity"

# 6. Push and create PR same day
git push -u origin feature/add-user-validation

# 7. Get review, merge to main
# 8. Delete feature branch immediately after merge
```

### Branch Naming Conventions

- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/fixes
- `chore/description` - Maintenance tasks

## Package Management Best Practices

### Understanding npm Commands

| Command                           | When to Use                                   | Modifies node_modules? | Modifies package-lock.json? |
| --------------------------------- | --------------------------------------------- | ---------------------- | --------------------------- |
| `npm install`                     | First install, adding dependencies (dev)      | ✅ Yes                 | ✅ Yes                      |
| `npm ci`                          | CI/CD, production deploys (reproducible)      | ✅ Yes (clean install) | ❌ No (fails if mismatched) |
| `npm install --package-lock-only` | Sync lockfile after manual package.json edits | ❌ No                  | ✅ Yes                      |
| `npm install <package>`           | Add new dependency                            | ✅ Yes                 | ✅ Yes                      |
| `npm uninstall <package>`         | Remove dependency                             | ✅ Yes                 | ✅ Yes                      |

### When to Use `npm install --package-lock-only`

✅ **Use this when:**

- You manually edited `package.json` (e.g., version bump during release)
- You need to sync `package-lock.json` without reinstalling `node_modules`
- You want to commit updated lockfile without side effects
- After merging `package.json` conflicts

❌ **DON'T use this when:**

- First time installing dependencies (use `npm install` or `npm ci`)
- Adding/removing packages (use `npm install <package>`)
- Fixing security vulnerabilities (use `npm audit fix`)
- In CI/CD pipelines (use `npm ci` instead)

### Common Workflows

#### 1. Version Bump (Release Process)

```bash
# Edit package.json version manually (e.g., 1.0.0 → 1.1.0)
npm install --package-lock-only    # Sync lockfile without reinstalling
git add package.json package-lock.json
git commit -m "chore(release): bump version to 1.1.0"
```

#### 2. After Pulling Changes

```bash
git pull origin main
npm ci                              # Clean install from lockfile (faster)
```

#### 3. Adding New Dependency

```bash
npm install express                 # Adds to package.json + updates lockfile
git add package.json package-lock.json
git commit -m "feat(deps): add express for HTTP server"
```

#### 4. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
npm ci                              # Reproducible, fails on lockfile mismatch
npm test
npm run build
```

### Security & Determinism

- ✅ **Always commit `package-lock.json`** to version control
- ✅ **Use `npm ci` in CI/CD** (faster, reproducible, fails on mismatch)
- ✅ **Use `--package-lock-only` for manual `package.json` edits** (no side effects)
- ❌ **Never edit `package-lock.json` manually**
- ❌ **Never gitignore `package-lock.json`** (breaks reproducibility)

### Troubleshooting Package Issues

#### Reset Everything

```bash
rm -rf node_modules package-lock.json
npm install                         # Fresh install
```

#### Check for Inconsistencies

```bash
npm ls                              # List installed packages
npm outdated                        # Check for outdated packages
npm audit                           # Security vulnerabilities
```

## Commit Conventions

We use **Conventional Commits** format:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Commit Types

- **feat**: New feature (triggers MINOR version bump)
- **fix**: Bug fix (triggers PATCH version bump)
- **docs**: Documentation only
- **refactor**: Code refactoring (no functional changes)
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes
- **build**: Build system changes
- **revert**: Revert previous commit
  git commit -m "feat: very long subject that exceeds the maximum character limit of 72 characters" # ❌ Too long

### Examples

```bash
# Good commits
git commit -m "feat(auth): add JWT token refresh mechanism"
git commit -m "fix(api): resolve null pointer in user lookup"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(logger): extract log formatting to utility"
```

```text
# Bad commits (will be rejected by commitlint)
git commit -m "fixed stuff"           # ❌ No type
git commit -m "Updated code"          # ❌ Not descriptive
git commit -m "feat: very long subject that exceeds the maximum character limit of 72 characters"  # ❌ Too long
```

### Commit Message Rules

- ✅ Subject must be ≤ 72 characters
- ✅ Use imperative mood ("add" not "added" or "adds")
- ✅ No emoji in commit messages
- ✅ Scope is optional but recommended
- ✅ Body is optional for complex changes
- ✅ Reference issues: `Fixes #123` or `Closes #456`

## Testing Guidelines

### Test Strategy

```text
Unit Tests       → Fast, isolated, no dependencies (default npm test)
Integration Tests → Database required, test DB interactions
E2E Tests        → Full stack, test HTTP endpoints
```

### When to Write Each Type

**Unit Tests** (`*.spec.ts`)

- Pure functions and business logic
- Services without external dependencies
- Utilities, validators, transformers
- **Run:** `npm test` (parallel, <5s timeout)

**Integration Tests** (`*.integration.spec.ts`)

- Database operations (TypeORM entities, repositories)
- External service integrations
- **Run:** `npm run test:integration:safe` (requires PostgreSQL, 30s timeout)

**E2E Tests** (`test/*.e2e.spec.ts`)

- Complete user workflows
- API endpoint validation
- **Run:** `npm run test:e2e:safe` (full stack, 60s timeout)

**BDD Tests** (`scripts/bdd-tests/*.test.js`)

- Behavior-Driven Development scenarios with Gherkin syntax
- Real WebSocket connections with Socket.IO client
- Human-readable test output for documentation
- **Run:** `npm run test:bdd` (all scenarios), `npm run test:bdd:connection`, `npm run test:bdd:presence`
- **Coverage:** BE-001.1 (Connection Management), BE-001.2 (Presence Tracking)
- **See:** `/docs/BDD_TEST_COVERAGE.md` for detailed flowchart and scenario breakdown

### Test Safety Guards

Always use **safe scripts** for integration/e2e tests:

```bash
# ✅ SAFE: Prevents production DB accidents
npm run test:integration:safe
npm run test:e2e:safe

# ⚠️ UNSAFE: No safety guards
npm run test:integration
npm run test:e2e
```

Safety guards check:

- `NODE_ENV=test` is set
- Database name doesn't contain "prod", "production", "live"
- Database host is localhost or safe pattern

### TDD Workflow

```bash
# 1. Write failing test
npm run test:watch

# 2. Implement minimal code to pass
# 3. Refactor while keeping tests green
# 4. Repeat
```

## Code Quality Standards

### Linting & Formatting

```bash
# Check quality (format + lint)
npm run quality

# Auto-fix issues
npm run quality:fix

# Format only
npm run format

# Lint only
npm run lint
```

### Cognitive Complexity Analysis

We enforce complexity limits via ESLint:

- **Cognitive Complexity**: Max 10
- **Cyclomatic Complexity**: Max 10
- **Function Length**: Max 50 lines
- **Parameters**: Max 4
- **Nesting Depth**: Max 3

**Analyze complexity:**

```bash
# Full analysis
npm run analyze

# Specific checks
npm run analyze:cognitive
npm run analyze:cyclomatic
npm run analyze:functions
npm run analyze:security

# Generate JSON report for CI
npm run analyze:json
```

**Refactoring Strategies:**

If you hit complexity limits:

1. **Extract Method**: Break into smaller functions
2. **Early Returns**: Use guard clauses
3. **Strategy Pattern**: Replace conditionals
4. **Configuration Objects**: Reduce parameters

## Pull Request Process

### Before Creating PR

1. ✅ All tests pass (`npm test`)
2. ✅ Code is formatted (`npm run format:check`)
3. ✅ No linting errors (`npm run lint:check`)
4. ✅ Build succeeds (`npm run build`)
5. ✅ Commit messages follow conventions
6. ✅ Branch is up-to-date with main

**Quick check:**

```bash
npm run verify
```

### PR Checklist

- [ ] **Title**: Follows conventional commit format
- [ ] **Description**: Clear explanation of changes
- [ ] **Tests**: Added/updated for new functionality
- [ ] **Documentation**: Updated if public API changed
- [ ] **Breaking Changes**: Documented with migration guide
- [ ] **CHANGELOG**: Updated (if applicable)
- [ ] **No Secrets**: No API keys, passwords, tokens committed

### PR Template (create in `.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code refactoring
- [ ] docs: Documentation update
- [ ] test: Test additions/updates
- [ ] chore: Maintenance

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing locally

## Checklist

- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Code Review Guidelines

**As Reviewer:**

- ✅ Check logic correctness
- ✅ Verify test coverage
- ✅ Ensure code readability
- ✅ Validate complexity limits
- ✅ Look for security issues
- ⚠️ Be constructive and respectful

**As Author:**

- ✅ Respond to all comments
- ✅ Address or justify feedback
- ✅ Keep PR scope focused
- ✅ Squash commits if needed

## Release Workflow

We use **Semantic Versioning** (MAJOR.MINOR.PATCH) with automated releases:

### Versioning Rules

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
- **PATCH** (1.0.0 → 1.0.1): Bug fixes

### Automated Release (main branch only)

**Preview release:**

```bash
npm run release:suggest
```

This shows what version would be released (dry-run mode).

**Create release:**

```bash
npm run release
```

This will:

1. ✅ Analyze commits since last tag
2. ✅ Calculate new version (semver)
3. ✅ Update `package.json` and `package-lock.json`
4. ✅ Generate CHANGELOG.md
5. ✅ Create git commit: `chore(release): bump version to X.Y.Z`
6. ✅ Create git tag: `vX.Y.Z`
7. ✅ Push commit and tag to remote

### Manual Release (advanced)

```bash
# Force specific version bump
npm run release:patch   # 1.0.0 → 1.0.1
npm run release:minor   # 1.0.0 → 1.1.0
npm run release:major   # 1.0.0 → 2.0.0
```

### Release Checklist

**Before release:**

- [ ] All tests passing in CI
- [ ] `main` branch is stable
- [ ] No uncommitted changes
- [ ] Local branch synced with remote

**After release:**

- [ ] Verify tag created on GitHub
- [ ] Check GitHub Release notes (if automated)
- [ ] Notify team if breaking changes

## Git Hooks

We use **Husky** for automated checks:

### Pre-Commit Hook

**Runs:** lint-staged (formats and lints staged files)

**Configured in:** `.husky/pre-commit`

**What happens:**

```bash
git commit
# → Formats .ts, .js files (Prettier)
# → Lints .ts, .js files (ESLint --fix)
# → Formats .json, .md, .yml files (Prettier)
# → Auto-fixes and stages changes
```

### Commit-Msg Hook

**Runs:** commitlint (validates commit message format)

**Configured in:** `.husky/commit-msg`

**What happens:**

```bash
git commit -m "invalid message"
# ❌ Rejected: Must follow conventional commits format

git commit -m "feat(api): add user endpoint"
# ✅ Accepted
```

### Pre-Push Hook (optional, disabled by default)

**Configured in:** `.husky-config.json`

Can run tests before push (disabled for TBD workflow - tests run in CI instead).

**To enable:**

Edit `.husky-config.json`:

```json
{
  "hooks": {
    "pre-push": {
      "enabled": true,
      "tests": {
        "unit": true,
        "integration": false,
        "e2e": false
      }
    }
  }
}
```

### Bypassing Hooks (emergency only)

```bash
# Skip pre-commit (NOT recommended)
git commit --no-verify -m "emergency fix"

# Skip pre-push
git push --no-verify
```

## Troubleshooting

### Tests Failing

**Problem:** Tests fail locally

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check Node version
node -v  # Must be >= 20.8.0

# Run specific test
npm test -- src/app.service.spec.ts
```

**Problem:** Integration tests fail

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Start database
docker-compose up -d

# Check database connection
npm run test:integration:safe
```

**Problem:** BDD tests fail with "ECONNREFUSED" or database errors

```bash
# BDD tests require WebSocket-only mode (no database)
# Set DATABASE_ENABLED=false in .env

# Edit .env
DATABASE_ENABLED=false  # ← Must be false for BDD tests
PORT=3000

# Restart server
npm run start:dev

# Run BDD tests
npm run test:bdd
```

**Why?** WebSocket Gateway can run without PostgreSQL. BDD tests focus on real-time communication, not persistence.

**Problem:** BDD tests fail with "JWT_INVALID: invalid signature"

```bash
# JWT_SECRET in .env must match the secret used in BDD tests
# Check current secret
grep JWT_SECRET .env

# BDD tests use this secret (scripts/bdd-tests/*.test.js):
JWT_SECRET=your_super_secure_jwt_secret_32_characters_minimum

# If different, update .env to match
```

**Problem:** "Working directory not clean" error

```bash
# Check uncommitted changes
git status

# Stash or commit changes
git stash
# or
git add . && git commit -m "chore: work in progress"
```

### Build Failures

**Problem:** TypeScript errors

```bash
# Clean build
rm -rf dist
npm run build

# Check tsconfig.json
cat tsconfig.json
```

**Problem:** Module not found

```bash
# Reinstall dependencies
npm ci
```

### Git Hook Issues

**Problem:** Hooks not running

```bash
# Reinstall Husky
npm run prepare

# Check hooks are executable
ls -la .husky/
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

**Problem:** Commitlint fails

```bash
# Check commit message format
git log -1 --pretty=%B

# Valid format: type(scope): subject
# Example: feat(api): add user endpoint
```

### Release Issues

**Problem:** Release fails with "not synchronized"

```bash
# Pull latest changes
git pull origin main

# Try release again
npm run release
```

**Problem:** Dry-run modified files (known bug, see BACKLOG.md BUG-001)

```bash
# Restore modified files
git restore package.json package-lock.json

# Use manual release instead
git tag -a v1.0.0 -m "Release v1.0.0"
git push --tags
```

## How to Pick a Task

We follow a **GitHub Issues → Epic → Story → Task** workflow:

### For New Contributors

1. **Browse GitHub Issues**

   ```bash
   # Look for beginner-friendly tasks
   https://github.com/your-org/collabornest/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22
   ```

   Labels to look for:
   - `good first issue` - Perfect for first-time contributors
   - `help wanted` - Contributions welcome
   - `bug` - Something broken that needs fixing
   - `enhancement` - New feature or improvement

2. **Understand the Context**
   - **Epic files**: Read the relevant Epic (e.g., `EPIC-001-websocket-gateway.md`)
   - **ROADMAP**: Check `/docs/project/ROADMAP.md` for current priorities
   - **PROJECT.md**: See `/docs/PROJECT.md` for complete technical specification

3. **Comment on the Issue**

   ```markdown
   Hi! I'd like to work on this. I have experience with [relevant skills].
   Could you assign this to me?

   Questions:

   - [Any clarifications needed]
   ```

4. **Get Assignment**
   - Maintainer will assign the issue to you
   - Read acceptance criteria carefully
   - Ask questions if anything is unclear

5. **Create Branch**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/issue-123-description
   ```

6. **Work on Task** (following TDD workflow)

   ```bash
   # Write test first
   npm run test:watch

   # Implement code
   # Refactor while keeping tests green

   # Verify quality
   npm run verify
   ```

7. **Submit Pull Request**
   - Fill PR template completely
   - Reference issue: `Closes #123`
   - Request review from maintainer

### For Regular Contributors

**Understanding the Epic Hierarchy**:

```
EPIC (large feature, 2-8 weeks)
  └── STORY (user-facing functionality, 1-5 days)
      └── TASK (implementation work, 2-8 hours)
```

**Example**:

- **Epic**: BE-001 (WebSocket Gateway Implementation) - 8 weeks
  - **Story**: BE-001.1 (WebSocket Connection Management) - 1-2 weeks
    - **Task**: Implement JWT validation - 4 hours
    - **Task**: Add heartbeat mechanism - 3 hours
    - **Task**: Write integration tests - 5 hours

**Task Selection Process**:

1. **Check ROADMAP.md** - What's the current priority?
2. **Check BACKLOG.md** - What issues are ready to work on?
3. **Pick a task that matches**:
   - Your skill level (difficulty rating)
   - Time available (time-box estimate)
   - Current sprint priorities

**Time-boxing Rules (XP)**:

- **Task**: Max 2 days (if longer, break it down)
- **Story**: Max 1 week
- **Epic**: Max 8 weeks

If you can't complete in time-box, **split the task** and create a follow-up issue.

### Task Labels Explained

| Label              | Meaning                            | Typical Contributor          |
| ------------------ | ---------------------------------- | ---------------------------- |
| `good first issue` | Beginner-friendly, well-documented | New contributors             |
| `help wanted`      | Contributions welcome              | Anyone                       |
| `epic`             | Large multi-story feature          | Team coordination            |
| `story`            | User-facing functionality          | Experienced contributors     |
| `task`             | Implementation work                | Anyone assigned              |
| `bug`              | Something broken                   | Anyone with debugging skills |
| `enhancement`      | New feature                        | Feature developers           |
| `documentation`    | Docs only                          | Writers, reviewers           |
| `testing`          | Test additions                     | QA, developers               |

### Finding Your First Task

**If you're new to the project**:

```bash
# Step 1: Read the quickstart
cat docs/QUICKSTART.md

# Step 2: Setup development environment
npm install
npm run verify

# Step 3: Pick a "good first issue"
# Browse: https://github.com/your-org/collabornest/labels/good%20first%20issue

# Step 4: Read related Epic
cat docs/project/EPIC-001-websocket-gateway.md  # (example)

# Step 5: Comment on issue expressing interest
```

**If you're familiar with the codebase**:

1. Check current sprint in `ROADMAP.md`
2. Find unassigned tasks in that Epic
3. Self-assign (if you have permissions) or request assignment
4. Create branch and start working

### Communication

- **Questions**: Comment on the GitHub issue
- **Blockers**: Tag maintainer in issue comment
- **Collaboration**: Join discussion in PR
- **Help**: Slack/Discord (post v1.0.0) or GitHub Discussions

## Getting Help

- **Issues**: Open a [GitHub issue](https://github.com/your-org/collabornest/issues/new/choose)
- **Questions**: Check existing issues or start a discussion
- **Security**: Report privately via [SECURITY.md](./SECURITY.md)
- **Documentation**: See `/docs/project/` for architecture decisions
- **Roadmap**: See [ROADMAP.md](./docs/project/ROADMAP.md) for development timeline

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

**Thank you for contributing!** 🎉
