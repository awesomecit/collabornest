# Morning Context Builder - Interactive Agent Workflow

> **Purpose**: Copilot Agent esegue questo workflow ogni mattina per preparare la sessione di sviluppo in modo interattivo e ottimizzato.

---

## WORKFLOW STEP 1: Initial Greeting & Triage

**Agent says:**

"Good morning! Let's prepare your development session.

Quick triage (answer with number):

1. Starting new feature/task
2. Debugging existing issue
3. Continuing yesterday's work
4. Code review/refactoring
5. Just exploring codebase

Your choice: \_\_\_"

---

## WORKFLOW STEP 2A: New Feature (if choice = 1)

**Agent asks:**

"Feature name: **_
Target module: _** (or 'new')
Estimated complexity (hours): \_\_\_"

**Agent automatically:**

- Check ROADMAP.md for planned work
- Verify no duplicate TASK-XXX.md exists
- Read relevant module structure (`src/<module>/`)
- Check test coverage for similar features
- List available npm scripts related to task

**Agent presents:**

"Setup summary:

- Module structure: [shows tree]
- Similar features: [lists related code]
- Test patterns: [shows test file examples]
- Next: Should I create TASK-XXX.md scaffold?"

---

## WORKFLOW STEP 2B: Debugging (if choice = 2)

**Agent asks:**

"Describe the bug in one sentence: **_
How to reproduce (command or steps): _**
Error message (if any): \_\_\_"

**Agent automatically executes:**

```bash
# 1. Gather project state
git status --porcelain
git log --oneline -5

# 2. Based on bug keywords, run targeted greps
# If mentions "test" → check test output
# If mentions "build" → check build errors
# If mentions "release" → check release config
# If mentions file names → show git blame for those files

# 3. Identify related files
git log --all --oneline --grep="<keyword>" | head -10

# 4. Show recent changes to suspected areas
git diff HEAD~5 -- <relevant-path>/**
```

**Agent presents hypothesis:**

"Analysis:

- Last touched: [file] by [commit] [time ago]
- Suspected area: [path/to/code]
- Related commits: [3 most recent]

Hypothesis: [educated guess]

Verification plan:

1. [command to check hypothesis]
2. [fallback if #1 fails]
3. [nuclear option: full trace]

Proceed with step 1?"

---

## WORKFLOW STEP 2C: Continue Yesterday (if choice = 3)

**Agent automatically:**

```bash
# Read yesterday's debrief
cat docs/dev/debrief-$(date -d "1 day ago" +%Y%m%d).md

# Extract:
# - Yesterday's focus (from commit messages)
# - Open action items
# - Current blockers
# - Uncommitted changes
```

**Agent asks:**

"Yesterday's summary:

- Focus: [extracted from commits]
- Completed: [X tasks]
- Pending: [Y action items]
- Uncommitted: [Z files]

Priority for today:

1. [Top action item from yesterday]
2. [Second priority]
3. [Third priority]

Which one? (1/2/3 or describe new): \_\_\_"

---

## WORKFLOW STEP 2D: Code Review (if choice = 4)

**Agent asks:**

"Review target:

1. Recent commits (show last N commits)
2. Specific PR/branch
3. BACKLOG issues for review

Choice: \_\_\_"

**Agent prepares:**

- Shows commit diffs (not full files)
- Highlights complex changes (large diffs)
- Runs linter/prettier check
- Shows test coverage delta
- Checks for TODO/FIXME additions

---

## WORKFLOW STEP 2E: Exploration (if choice = 5)

**Agent asks:**

"What area interests you?

1. Module overview (which module?)
2. Architecture patterns
3. Test strategy
4. CI/CD pipeline
5. Dependencies audit

Choice: \_\_\_"

**Agent provides contextual tour:**

- For modules: tree + main exports + test files
- For patterns: grep for common patterns, show examples
- For tests: coverage report + test structure
- For CI/CD: .github/workflows analysis
- For deps: npm outdated + license check

---

## WORKFLOW STEP 3: Context File Generation

**Agent says:**

"I've gathered the context. Generating checkpoint file..."

**Agent creates:**

`/tmp/copilot-session-$(date +%Y%m%d-%H%M%S).md`

**Contains:**

```markdown
# Session Context - [Date Time]

## Task

[User's stated goal]

## Project State

- Branch: [current]
- Last commit: [hash - message]
- Uncommitted: [count] files
- Tests: [passing/failing]
- Coverage: [X%]

## Relevant Files

[Auto-detected based on task]

## Pre-Analysis

[Grep results, config dumps, etc.]

## Next Steps

1. [First action]
2. [Second action]
3. [Third action]

## Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
```

**Agent asks:**

"Context saved to [file path].
Review? (Y to view, N to proceed, E to edit): \_\_\_"

---

## WORKFLOW STEP 4: Execution Mode Selection

**Agent asks:**

"How should we proceed?

1. Guided mode (I suggest each step, you approve)
2. Auto mode (I execute plan, pause on errors)
3. Pair mode (collaborative, real-time discussion)

Choice: \_\_\_"

---

## WORKFLOW STEP 5: Progress Tracking

**Throughout session, agent maintains:**

```markdown
## Session Progress

[09:15] Started - Task: Fix dry-run bug
[09:20] ✓ Context gathered (2250 token)
[09:25] ✓ Hypothesis confirmed (500 token)
[09:30] ✓ Fix applied (800 token)
[09:35] ✓ Tests passing
[09:40] ✓ Committed (1 commit)

Total: 3550 token, 25 min
Efficiency: 142 token/min
```

---

## WORKFLOW STEP 6: Session Wrap-Up

**Agent asks (at end or on demand):**

"Ready to wrap up?

1. Generate commit message
2. Update BACKLOG.md
3. Create debrief report
4. All of the above

Choice: \_\_\_"

**Agent executes choice, then:**

"Session summary:

- Duration: [X min]
- Commits: [N]
- Token usage: [~X]
- Tasks completed: [Y]

Save for tomorrow? (creates session-notes.md entry): Y/N"

---

## TOKEN OPTIMIZATION TECHNIQUES

### Batch Operations

```javascript
// Instead of 3 separate questions:
"What's the bug?" → answer → 500 token
"How to reproduce?" → answer → 500 token
"Expected behavior?" → answer → 500 token

// Ask once:
"Describe: (1) bug, (2) reproduction, (3) expected behavior"
→ answer → 800 token (savings: 700 token)
```

### Incremental Reads

```bash
# Don't read full files upfront
# Read only when needed, only relevant sections

# BAD: Read entire auto-release.js (981 lines, 3000 token)
# GOOD: grep for specific function (15 lines, 100 token)
```

### Diff-First Strategy

```bash
# Show changes, not full content
git diff HEAD~1 -- scripts/auto-release.js
# ~200 lines vs 981 full file → 75% reduction
```

### Checksum Probes

```bash
# Instead of reading file to check if modified:
md5sum package.json before/after
# 32 bytes vs 500 lines → 99% reduction
```

---

## CUSTOMIZATION: Project-Specific Shortcuts

Add to `.copilot-workflow-config.json`:

```json
{
  "shortcuts": {
    "test": "npm test -- --passWithNoTests",
    "build": "npm run build",
    "lint": "npm run lint",
    "release-dry": "npm run release:suggest",
    "coverage": "npm run test:coverage:check"
  },
  "contextPaths": {
    "release": [".release-config.json", "scripts/auto-release.js"],
    "test": ["jest.config.js", "jest.*.config.js"],
    "hooks": [".husky/", ".husky-config.json"]
  },
  "commonGreps": {
    "writes": "grep -rn 'writeFileSync|writeFile' scripts/",
    "guards": "grep -rn 'dryRun|dry-run' scripts/",
    "todos": "grep -rn 'TODO|FIXME' src/"
  }
}
```

**Agent reads config and uses shortcuts automatically.**

---

## USAGE INSTRUCTIONS

### For Developer

**Every morning:**

```
1. Open Copilot Agent chat
2. Paste: "Execute morning-context-builder.md workflow"
3. Answer prompts interactively
4. Let agent prepare context
5. Start working with pre-loaded context
```

**Estimated time:** 3-5 min (vs 20+ min manual context gathering)

**Token savings:** ~70-80% vs traditional approach

### For Agent

**Execution rules:**

1. **One question at a time** - don't overwhelm
2. **Show, don't tell** - prefer diffs over full files
3. **Batch when possible** - group related questions
4. **Checkpoint often** - save state after major steps
5. **Measure efficiency** - track token/time per session

---

## SUCCESS METRICS

Track in `docs/dev/workflow-metrics.csv`:

```csv
Date,Task,TokenUsed,TimeMin,Commits,Efficiency
2025-11-15,dry-run-bug,2500,25,3,100
2025-11-16,add-feature,1800,35,2,51
```

**Goal:** <2000 token average, <30 min sessions, >80 token/min efficiency

---

## VERSION HISTORY

- **v1.0.0** (2025-11-15): Initial interactive workflow
- Future: Add AI-suggested optimizations based on metrics

---

**Maintainer:** Development Team
**Feedback:** Open issue in repo or update this file directly
