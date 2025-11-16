# Daily Debug Session - Context Gathering Agent Prompt

> **Instructions for Copilot Agent**: Execute this prompt at the start of each debugging session. Ask questions dynamically, gather context intelligently, then proceed with the fix.

---

## PHASE 1: ISSUE INTAKE (Interactive)

Ask the developer:

1. **What's broken?** (One sentence summary)
2. **How do you reproduce it?** (Command or steps)
3. **What should happen?** (Expected behavior)
4. **What actually happens?** (Actual behavior + error message if any)

---

## PHASE 2: AUTOMATIC CONTEXT GATHERING

Execute these checks automatically (DON'T ask, just do):

### Project Snapshot

```bash
# Read package.json for stack info
- Project name & version
- Node version requirement
- Key dependencies (NestJS, TypeScript, Jest versions)
- Package manager (check for pnpm-lock.yaml, yarn.lock, package-lock.json)
```

### Repository State

```bash
# Check git status
- Current branch
- Last 3-5 commits (git log --oneline -5)
- Uncommitted changes (git status --porcelain)
- Sync with remote (ahead/behind)
```

### Relevant Configuration

Based on issue description keywords, read:

- If mentions "release" → `.release-config.json`
- If mentions "test" → `jest.config.js` (coverage thresholds)
- If mentions "lint" → `eslint.config.mjs`
- If mentions "hook" → `.husky/` files

---

## PHASE 3: TARGETED PRE-ANALYSIS

Based on issue type, run appropriate searches:

### If issue involves "dry-run" or "side effects"

```bash
# Search for file writes
grep -rn "writeFileSync|writeFile|appendFile|copyFileSync" scripts/ --include="*.js"

# Search for dry-run guards
grep -rn "dryRun|dry-run" scripts/ --include="*.js" | grep -E "if.*dryRun|--dry-run"
```

### If issue involves "external calls"

```bash
# Search for script invocations
grep -rn "execCommand.*\.js|execSync.*\.js" scripts/ --include="*.js"
```

### If issue involves "file modifications"

```bash
# Show MD5 checksums of suspected files
md5sum package.json package-lock.json (or other relevant files)
```

### If issue involves "test failures"

```bash
# Show recent test output
npm test -- --passWithNoTests 2>&1 | tail -50
```

---

## PHASE 4: HYPOTHESIS GENERATION

Present to the developer:

1. **Suspected root cause** (based on context gathered)
2. **3 verification steps** (commands to run to confirm hypothesis)
3. **Expected findings** (what output confirms the bug)

Ask: "Should I proceed with verification step 1?"

---

## PHASE 5: ITERATIVE DEBUGGING

For each verification step:

1. Execute the command
2. Analyze output
3. Update hypothesis if needed
4. Propose next step

**CRITICAL**: After EACH step, show:

- What was found
- What it means
- What to do next

DON'T run 5 commands silently then dump results - that's wasteful.

---

## PHASE 6: FIX PROPOSAL

Once root cause confirmed:

1. **Show minimal diff** (not full file content)
2. **Explain why this fixes it** (one sentence)
3. **Identify side effects** (what else might break)
4. **Propose verification** (command to prove fix works)

Ask: "Should I apply this fix?"

---

## PHASE 7: VERIFICATION & CLEANUP

After fix applied:

1. Run verification command
2. Check for regressions (run test suite)
3. Verify no unintended file changes (git status)
4. Suggest commit message (conventional commits format)

---

## TOKEN OPTIMIZATION RULES

### DO

- ✅ Batch related questions (ask 3 things at once, not separately)
- ✅ Use `git diff` instead of reading full files
- ✅ Use `grep -c` for counts, not full output
- ✅ Read only relevant sections of large files
- ✅ Show checksums instead of file contents when checking for changes

### DON'T

- ❌ Read entire files when `grep` suffices
- ❌ Run same command twice
- ❌ Show 100-line outputs when 10-line summary works
- ❌ Ask for information that's in previous context
- ❌ Use `semantic_search` when `grep_search` is faster

---

## CONTEXT PRESERVATION

After each major step, internally summarize:

- What we know so far
- What we've ruled out
- What remains to verify

This prevents re-asking questions later.

---

## EXAMPLE SESSION FLOW

```
Agent: "I'll help debug this. First, what's the issue?"
User: "npm run release:suggest modifies files in dry-run mode"

Agent: [Auto-gathers context]
      "I see you're on branch main, last commit was c9c59ac.
       I found 3 writeFileSync calls in scripts/.
       Checking dry-run guards...

       Hypothesis: version-calculator.js called without --dry-run flag.

       Let me verify: Should I check auto-release.js line 376?"

User: "yes"

Agent: [Runs grep, shows line]
      "Confirmed. Line 376 calls version-calculator without flag.

       Fix: Add '--dry-run' to execCommand() call.

       Diff:
       - execCommand(`node scripts/version-calculator.js ${releaseType}`, false, true);
       + execCommand(`node scripts/version-calculator.js ${releaseType} --dry-run`, false, true);

       This ensures the child script respects dry-run mode.
       Apply?"

User: "yes"

Agent: [Applies fix, runs verification]
      "Fixed. Verification:
       - MD5 checksums unchanged after dry-run ✓
       - Tests passing ✓
       - No uncommitted files ✓

       Suggested commit:
       fix(release): pass --dry-run flag to version-calculator script"
```

Total: ~1500 token (vs 5000+ with traditional approach)

---

## WHEN TO USE THIS PROMPT

**Use daily-debug-session.md when:**

- Multi-file coordination needed
- Complex root cause analysis
- Unknown codebase area
- High-stakes fix (production issue)

**Don't use when:**

- Quick syntax question
- Single typo fix
- Known pattern application
- Just need code generation

---

## CUSTOMIZATION HOOKS

Adapt Phase 3 searches based on your project:

```javascript
// Add project-specific patterns
const issuePatterns = {
  'dry-run': ['writeFile', 'dryRun', 'execCommand'],
  websocket: ['ws.send', 'socket.emit', 'connection'],
  database: ['query', 'transaction', 'migration'],
  auth: ['jwt', 'token', 'session', 'cookie'],
  // Add your patterns here
};
```

---

## SUCCESS METRICS

Track in `docs/dev/session-notes.md`:

- Time to root cause: \_\_\_ min
- Token usage: ~\_\_\_ token
- Iterations needed: \_\_\_
- Fix successful on first try: Y/N

Goal: <10 min, <2000 token, <3 iterations

---

**Version:** 1.0.0
**Last Updated:** 2025-11-15
**Maintainer:** Development Team
