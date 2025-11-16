# Quickstart Guide

> **Goal**: Get from zero to your first commit in 15 minutes.

## What You'll Learn

- ✅ Setup development environment
- ✅ Run your first tests
- ✅ Make a code change
- ✅ Create your first commit (with git hooks validation)
- ✅ Understand project structure

## Prerequisites Check

Before starting, verify you have:

```bash
# Check Node.js version (must be >= 20.8.0)
node -v

# Check npm version (must be >= 10.0.0)
npm -v

# Check Git
git --version

# Check Docker (optional, for database tests)
docker --version
```

**Missing something?**

- **Node.js**: Download from [nodejs.org](https://nodejs.org/) (LTS version)
- **Docker**: Download from [docker.com](https://www.docker.com/get-started)

## Step 1: Clone and Install (2 min)

```bash
# Clone repository
git clone <your-repo-url>
cd nestjs-template-generator

# Install dependencies
npm install

# Expected output:
# added XXX packages in XXs
```

**What just happened?**

- Installed all dependencies from `package.json`
- Husky git hooks were automatically setup (`npm run prepare`)
- `node_modules/` folder created

## Step 2: Verify Setup (3 min)

```bash
# Run full verification
npm run verify
```

**This runs 4 checks:**

1. ✅ **Format check**: Prettier validates code style
2. ✅ **Lint check**: ESLint validates code quality
3. ✅ **Tests**: Jest runs all unit tests (112 tests)
4. ✅ **Build**: TypeScript compiles to JavaScript

**Expected output:**

```text
> format:check
All matched files use Prettier code style! ✅

> lint:check
(no output = success) ✅

> test
Test Suites: 11 passed, 11 total
Tests:       112 passed, 112 total ✅

> build
(TypeScript compilation successful) ✅
```

**Troubleshooting:**

```bash
# If tests fail:
rm -rf node_modules package-lock.json
npm install

# If build fails:
rm -rf dist
npm run build
```

## Step 3: Explore Project Structure (2 min)

```text
nestjs-template-generator/
├── src/                  # Source code
│   ├── common/           # Shared utilities (logger, filters, interceptors)
│   ├── config/           # Configuration and env validation
│   ├── health/           # Health check endpoints
│   ├── swagger/          # API documentation
│   └── main.ts           # Application entry point
│
├── test/                 # E2E and integration tests
├── scripts/              # Automation scripts (release, complexity analysis)
├── docs/                 # Documentation
│   └── project/          # Project management (BACKLOG, ROADMAP)
│
├── .husky/               # Git hooks (pre-commit, commit-msg)
├── .env.example          # Environment template
├── docker-compose.yml    # PostgreSQL for development
│
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Test configuration (unit tests)
├── eslint.config.mjs     # Linting rules
│
├── README.md             # Project overview
├── CONTRIBUTING.md       # How to contribute
└── QUICKSTART.md         # This file!
```

**Key files to know:**

- `src/main.ts`: Where the app starts
- `package.json`: All npm scripts live here
- `.env.example`: Copy to `.env` for local config
- `CONTRIBUTING.md`: Detailed development workflow

## Step 4: Make Your First Change (3 min)

Let's add a simple feature to practice the workflow.

### Example: Add a new endpoint to AppController

1. **Open the file:**

   ```bash
   # Edit src/app.controller.ts
   ```

2. **Add a new method:**

   ```typescript
   @Get('ping')
   ping(): string {
     return 'pong';
   }
   ```

3. **Add a test:**

   ```bash
   # Edit src/app.controller.spec.ts
   ```

   ```typescript
   it('should return "pong" from /ping endpoint', () => {
     expect(appController.ping()).toBe('pong');
   });
   ```

4. **Run tests to verify:**

   ```bash
   npm test -- src/app.controller.spec.ts

   # Expected:
   # PASS src/app.controller.spec.ts
   # ✓ should return "pong" from /ping endpoint
   ```

## Step 5: Commit Your Change (5 min)

Now let's commit following project conventions.

**Understanding Git Hooks:**

When you run `git commit`, two hooks automatically run:

1. **pre-commit**: Formats and lints your code
2. **commit-msg**: Validates commit message format

**Commit format required:**

```text
<type>(<scope>): <subject>

Examples:
feat(api): add ping endpoint
fix(auth): resolve token expiration bug
docs(readme): update installation steps
```

**Let's commit:**

```bash
# 1. Stage your changes
git add src/app.controller.ts src/app.controller.spec.ts

# 2. Commit with conventional format
git commit -m "feat(api): add ping endpoint for health check"

# Expected output:
# Running pre-commit checks...
# ✔ Formatting and linting...
# ✔ Validating commit message...
# [main abc1234] feat(api): add ping endpoint for health check
```

**Common commit errors:**

```bash
# ❌ Bad: No type
git commit -m "added ping endpoint"
# Error: subject may not be empty [subject-empty]

# ❌ Bad: Subject too long (>72 chars)
git commit -m "feat(api): add a really long description that exceeds..."
# Error: subject must not be longer than 72 characters [subject-max-length]

# ✅ Good: Follows conventions
git commit -m "feat(api): add ping endpoint"
```

## Step 6: Run Development Server (Optional)

```bash
# Start development server with hot reload
npm run start:dev

# Expected output:
# [Nest] 12345  - 15/11/2025, 13:00:00   LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 15/11/2025, 13:00:00   LOG [InstanceLoader] AppModule dependencies initialized
# [Nest] 12345  - 15/11/2025, 13:00:00   LOG [NestApplication] Nest application successfully started
# [Nest] 12345  - 15/11/2025, 13:00:00   LOG Application is running on: http://localhost:3000
```

**Test your endpoint:**

```bash
# In another terminal:
curl http://localhost:3000/ping

# Expected: pong
```

**Access Swagger docs:**

Open browser: `http://localhost:3000/api`

**Stop server:**

Press `Ctrl + C`

## Quick Reference Commands

### Everyday Development

```bash
# Run tests (fast, no database)
npm test

# Run tests in watch mode (TDD)
npm run test:watch

# Format and lint code
npm run quality:fix

# Check code quality
npm run quality

# Build project
npm run build

# Start development server
npm run start:dev
```

### Testing with Database

```bash
# Start PostgreSQL
docker-compose up -d

# Run integration tests (safe mode)
npm run test:integration:safe

# Run E2E tests (safe mode)
npm run test:e2e:safe

# Stop database
docker-compose down
```

### Quality Analysis

```bash
# Analyze cognitive complexity
npm run analyze

# Generate complexity report
npm run analyze:report

# View report
cat reports/complexity-report.json
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, then commit
git add .
git commit -m "feat(scope): description"

# Push to remote
git push -u origin feature/my-feature

# Create Pull Request on GitHub
```

## Next Steps

Now that you're set up, here's what to explore:

1. **Read CONTRIBUTING.md** - Full development workflow, testing strategy, PR process
2. **Check docs/project/BACKLOG.md** - Known issues and future features
3. **Explore src/common/** - Reusable utilities (logger, filters, interceptors)
4. **Try release workflow** - `npm run release:suggest` (preview releases)
5. **Review .husky-config.json** - Customize git hooks behavior

## Understanding Test Types

**When to use each:**

```bash
# Unit Tests (*.spec.ts)
# - Test isolated logic
# - No database, no HTTP
# - Fast (<5s total)
npm test

# Integration Tests (*.integration.spec.ts)
# - Test database operations
# - Requires PostgreSQL running
# - Medium speed (~30s total)
npm run test:integration:safe

# E2E Tests (test/*.e2e.spec.ts)
# - Test complete user workflows
# - Full stack: HTTP + DB
# - Slower (~60s total)
npm run test:e2e:safe
```

## Common Workflows

### Adding a New Feature

```bash
# 1. Create branch
git checkout -b feature/user-authentication

# 2. Write failing test (TDD)
npm run test:watch

# 3. Implement feature
# ... edit code ...

# 4. Ensure tests pass
npm test

# 5. Check quality
npm run quality:fix

# 6. Commit
git add .
git commit -m "feat(auth): add JWT authentication"

# 7. Push and create PR
git push -u origin feature/user-authentication
```

### Fixing a Bug

```bash
# 1. Create branch
git checkout -b fix/user-login-crash

# 2. Write regression test
# ... add test that reproduces bug ...

# 3. Fix the bug
# ... edit code ...

# 4. Verify fix
npm test

# 5. Commit
git commit -m "fix(auth): prevent crash on invalid credentials"

# 6. Push
git push
```

### Refactoring Code

```bash
# 1. Check current complexity
npm run analyze:cognitive

# 2. Refactor code
# ... extract methods, reduce nesting ...

# 3. Ensure tests still pass
npm test

# 4. Verify complexity improved
npm run analyze:cognitive

# 5. Commit
git commit -m "refactor(auth): reduce login complexity from 15 to 8"
```

## Troubleshooting Common Issues

### "Cannot find module '@nestjs/core'"

```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Tests failing after git pull"

```bash
# Solution: Update dependencies
npm install

# Clean build
rm -rf dist
npm run build
```

### "Commit rejected by commitlint"

```bash
# Check your commit message format
# Must be: type(scope): subject

# Valid types: feat, fix, docs, refactor, test, chore, perf, ci

# Examples:
git commit -m "feat(api): add user endpoint"    # ✅
git commit -m "fix(db): resolve connection leak" # ✅
git commit -m "Updated stuff"                   # ❌
```

### "Database connection failed"

```bash
# 1. Check Docker is running
docker ps

# 2. Start database
docker-compose up -d

# 3. Check logs
docker-compose logs app-database

# 4. Verify connection
npm run test:integration:safe
```

### "Port 3000 already in use"

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
echo "PORT=3001" >> .env
```

## Getting Help

**Stuck? Here's where to look:**

1. **README.md** - Project overview and features
2. **CONTRIBUTING.md** - Detailed development guide
3. **docs/project/BACKLOG.md** - Known issues and workarounds
4. **GitHub Issues** - Search existing issues
5. **Error messages** - Read carefully, often self-explanatory

**Still stuck?**

- Open a GitHub issue with:
  - What you tried
  - Expected vs actual result
  - Error message (full output)
  - Environment (OS, Node version)

---

**Congratulations!** 🎉 You're ready to contribute to the project.

**Next**: Read [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete development workflow.
