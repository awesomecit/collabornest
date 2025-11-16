# Git Hooks Configuration

This directory contains git hooks managed by Husky.

## Hooks

- **commit-msg**: Validates commit messages using commitlint (conventional commits)
- **pre-commit**: Runs lint-staged on modified files + optional tests
- **pre-push**: Runs build + optional tests + auto-release (branch-specific)

## Configuration

All hooks read from `.husky-config.json` in the project root.

### Quick Examples

**Fast iteration (no tests):**

```json
{
  "hooks": {
    "pre-commit": { "runLintStaged": true, "tests": { "unit": false } },
    "pre-push": { "runBuild": true, "tests": { "unit": false } }
  }
}
```

**Quality-first (all tests):**

```json
{
  "hooks": {
    "pre-commit": { "tests": { "unit": true } },
    "pre-push": { "tests": { "unit": true, "integration": true, "e2e": true } }
  }
}
```

**Branch-specific:**

```json
{
  "hooks": {
    "pre-push": {
      "branches": {
        "develop": { "tests": { "unit": true, "integration": true } },
        "main": { "tests": { "unit": false, "integration": false } }
      }
    }
  }
}
```

See `.husky-config.example.json` for full configuration options.

## Disabling Hooks

Temporarily disable all hooks:

```bash
export HUSKY=0
git commit ...
```

Or disable in configuration:

```json
{
  "hooks": {
    "pre-commit": { "enabled": false },
    "pre-push": { "enabled": false }
  }
}
```

## Troubleshooting

**Hooks not running:**

- Ensure Husky is installed: `npm run prepare`
- Check hook permissions: `chmod +x .husky/*`
- Verify configuration: `cat .husky-config.json`

**Tests taking too long:**

- Disable tests in hooks, rely on CI/CD
- Set `"tests": { "unit": false, "integration": false, "e2e": false }`

**Skip hooks on specific branches:**

- Add to `skipOnBranches`: `["feature/*", "fix/*"]`
