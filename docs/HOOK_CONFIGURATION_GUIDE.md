# Git Hooks Configuration Guide

## Overview

This template provides granular control over git hooks behavior using `.husky-config.json`.

## Test Granularity Levels

### Per-Hook Configuration

Control which tests run in `pre-commit` and `pre-push` hooks:

```json
{
  "hooks": {
    "pre-commit": {
      "tests": {
        "unit": false, // Run unit tests (npm test)
        "integration": false, // Run integration tests (npm run test:integration)
        "e2e": false // Run e2e tests (npm run test:e2e)
      }
    },
    "pre-push": {
      "tests": {
        "unit": false,
        "integration": false,
        "e2e": false
      }
    }
  }
}
```

### Per-Branch Configuration

Different test strategies per branch:

```json
{
  "hooks": {
    "pre-push": {
      "branches": {
        "main": {
          "tests": { "unit": false, "integration": false, "e2e": false }
        },
        "develop": {
          "tests": { "unit": true, "integration": true, "e2e": false }
        },
        "staging": {
          "tests": { "unit": true, "integration": true, "e2e": true }
        }
      }
    }
  }
}
```

## Common Workflows

### 1. Fast Iteration (Recommended)

No tests in hooks, all testing in CI/CD:

```json
{
  "hooks": {
    "pre-commit": {
      "runLintStaged": true,
      "tests": { "unit": false, "integration": false, "e2e": false }
    },
    "pre-push": {
      "runBuild": true,
      "tests": { "unit": false, "integration": false, "e2e": false }
    }
  }
}
```

**Pros:**

- Fast commits (<5 seconds)
- Fast pushes (<30 seconds)
- Tests run in parallel in CI/CD

**Cons:**

- Might push broken code
- Feedback delayed to CI/CD

### 2. Quality Gate

Run tests before push to prevent broken code:

```json
{
  "hooks": {
    "pre-commit": {
      "runLintStaged": true,
      "tests": { "unit": false, "integration": false, "e2e": false }
    },
    "pre-push": {
      "runBuild": true,
      "tests": { "unit": true, "integration": false, "e2e": false }
    }
  }
}
```

**Pros:**

- Catches errors before push
- Quick feedback (unit tests only)

**Cons:**

- Slower push (1-2 minutes)
- Still might miss integration issues

### 3. Full Quality (Not Recommended)

Run all tests before push:

```json
{
  "hooks": {
    "pre-push": {
      "tests": { "unit": true, "integration": true, "e2e": true }
    }
  }
}
```

**Pros:**

- Maximum quality assurance
- Never push broken code

**Cons:**

- Very slow (5-10+ minutes per push)
- Violates TBD principles
- Developer frustration

### 4. Branch-Specific Strategy (Best of Both Worlds)

```json
{
  "hooks": {
    "pre-push": {
      "skipOnBranches": ["feature/*", "fix/*"],
      "branches": {
        "main": {
          "runBuild": true,
          "tests": { "unit": false, "integration": false, "e2e": false }
        },
        "develop": {
          "runBuild": true,
          "tests": { "unit": true, "integration": true, "e2e": false }
        }
      }
    }
  }
}
```

**Workflow:**

- Feature branches: No hooks, fast iteration
- Develop: Unit + Integration tests before push
- Main: No tests (CI/CD handles it)

## Test Execution Priority

When multiple test types are enabled, they run in sequence:

1. **Unit tests** (`npm test`)
2. **Integration tests** (`npm run test:integration`)
3. **E2E tests** (`npm run test:e2e`)

Any failure stops the hook and prevents commit/push.

## Performance Considerations

### Test Suite Timings (Approximate)

- **Unit tests**: 3-5 seconds
- **Integration tests**: 30-60 seconds (requires DB)
- **E2E tests**: 1-3 minutes (requires DB + app startup)

### Recommended Configuration

```json
{
  "hooks": {
    "pre-commit": {
      "runLintStaged": true,
      "tests": { "unit": false, "integration": false, "e2e": false }
    },
    "pre-push": {
      "runBuild": true,
      "skipOnBranches": ["feature/*", "fix/*", "hotfix/*"],
      "branches": {
        "main": {
          "tests": { "unit": false, "integration": false, "e2e": false }
        },
        "develop": {
          "tests": { "unit": true, "integration": false, "e2e": false }
        }
      }
    }
  }
}
```

**Why this works:**

- Fast commits (5s) - only lint staged files
- Fast push on feature branches (skip hooks)
- Quality gate on develop (unit tests, 10s)
- No tests on main (CI/CD validates everything)

## CI/CD Integration

Let GitHub Actions handle heavy testing:

**Local (Git Hooks):**

- Lint staged files
- Quick build check
- Optional: Unit tests on critical branches

**CI/CD (GitHub Actions):**

- All unit tests
- Integration tests with real database
- E2E tests with full app
- Coverage reporting
- Security scanning

This separation gives:

- Fast local development
- Comprehensive CI/CD validation
- Best of both worlds

## Troubleshooting

**Q: Tests run even though they're disabled?**
A: Check `.husky-config.json` syntax. Use `runTests: false` AND `tests: { unit: false, ... }`

**Q: How to temporarily skip hooks?**
A: `export HUSKY=0` before git commands, or `git commit --no-verify`

**Q: Different behavior on different branches?**
A: Use branch-specific configuration in `branches` object

**Q: Hook doesn't respect config?**
A: Verify `.husky-config.json` is valid JSON and in project root

## Examples

See `.husky-config.example.json` for complete configuration examples.
