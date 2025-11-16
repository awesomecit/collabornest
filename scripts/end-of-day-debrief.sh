#!/bin/bash
set -euo pipefail

# ==============================================================================
# End-of-Day Debriefing Script
# ==============================================================================
# Genera un report della giornata di sviluppo e identifica pattern/insights
# per migliorare future sessioni Copilot e qualità del codice.
#
# Usage:
#   ./scripts/end-of-day-debrief.sh [optional-output-file]
#
# Output:
#   docs/dev/session-notes.md (appends) + terminal report
# ==============================================================================

OUTPUT_FILE="${1:-docs/dev/debrief-$(date +%Y%m%d).md}"
SESSION_NOTES="docs/dev/session-notes.md"

# Ensure docs/dev exists
mkdir -p docs/dev

echo "📊 Generating End-of-Day Debrief..."
echo ""

# ==============================================================================
# COLLECT DATA
# ==============================================================================

TODAY=$(date +%Y-%m-%d)
START_OF_DAY=$(git log --since="$TODAY 00:00" --format='%H' | tail -1)
END_OF_DAY=$(git log -1 --format='%H')

COMMITS_TODAY=$(git log --since="$TODAY 00:00" --oneline | wc -l | tr -d ' ')
FILES_CHANGED=$(git diff --stat "$START_OF_DAY".."$END_OF_DAY" 2>/dev/null | tail -1 || echo "0 files changed")
TESTS_ADDED=$(git diff "$START_OF_DAY".."$END_OF_DAY" -- '*.spec.ts' '*.test.ts' 2>/dev/null | grep -c '^+.*it(' || echo "0")
LINES_ADDED=$(git diff --shortstat "$START_OF_DAY".."$END_OF_DAY" 2>/dev/null | grep -oP '\d+(?= insertion)' || echo "0" | head -1)
LINES_REMOVED=$(git diff --shortstat "$START_OF_DAY".."$END_OF_DAY" 2>/dev/null | grep -oP '\d+(?= deletion)' || echo "0" | head -1)

# Test results
TEST_RESULTS=$(npm test -- --passWithNoTests --silent 2>&1 | tail -20 || echo "Tests not run")
COVERAGE=$(npm run test:coverage:check 2>&1 | grep -A 5 "Coverage summary" || echo "Coverage not available")

# Code quality checks
ESLINT_ISSUES=$(npm run lint 2>&1 | grep -c "problem" 2>/dev/null || echo "0")
PRETTIER_ISSUES=$(npm run format:check 2>&1 | grep -c "Code style issues" 2>/dev/null || echo "0")

# Clean up whitespace from all numeric variables
COMMITS_TODAY=$(echo "$COMMITS_TODAY" | tr -d ' \n')
TESTS_ADDED=$(echo "$TESTS_ADDED" | tr -d ' \n')
LINES_ADDED=$(echo "$LINES_ADDED" | tr -d ' \n')
LINES_REMOVED=$(echo "$LINES_REMOVED" | tr -d ' \n')
ESLINT_ISSUES=$(echo "$ESLINT_ISSUES" | tr -d ' \n')
PRETTIER_ISSUES=$(echo "$PRETTIER_ISSUES" | tr -d ' \n')

# ==============================================================================
# GENERATE REPORT
# ==============================================================================

cat > "$OUTPUT_FILE" << EOF
# End-of-Day Debrief - $TODAY

> Generated: $(date -Iseconds)
> Session Duration: Full day
> Commit Range: ${START_OF_DAY:0:7}..${END_OF_DAY:0:7}

---

## 📊 PRODUCTIVITY METRICS

**Commits:** $COMMITS_TODAY
**Files Changed:** $FILES_CHANGED
**Code Delta:** +$LINES_ADDED / -$LINES_REMOVED lines
**Tests Added:** $TESTS_ADDED new test cases

---

## 📝 COMMIT HISTORY (Today)

\`\`\`
$(git log --since="$TODAY 00:00" --format='%h - %s (%an, %ar)' --reverse)
\`\`\`

**Commit Type Breakdown:**
\`\`\`
$(git log --since="$TODAY 00:00" --format='%s' | sed 's/(.*//' | sort | uniq -c | sort -rn)
\`\`\`

---

## 🧪 QUALITY GATES

**Test Status:**
\`\`\`
$TEST_RESULTS
\`\`\`

**Coverage Summary:**
\`\`\`
$COVERAGE
\`\`\`

**Linting Issues:** $ESLINT_ISSUES problems found
**Formatting Issues:** $PRETTIER_ISSUES files need formatting

---

## 🐛 ISSUES WORKED ON

**From BACKLOG.md:**
\`\`\`
$(grep -B 5 -A 10 "Discovered.*$TODAY" docs/project/BACKLOG.md 2>/dev/null || echo "No issues recorded today")
\`\`\`

**Status Changes:**
- Open → In Progress: $(git diff HEAD~"$COMMITS_TODAY" HEAD -- docs/project/BACKLOG.md 2>/dev/null | grep -c "Status.*In Progress" || echo "0")
- In Progress → Completed: $(git diff HEAD~"$COMMITS_TODAY" HEAD -- docs/project/BACKLOG.md 2>/dev/null | grep -c "Status.*Completed" || echo "0")

---

## 🔍 CODE HOTSPOTS (Most Changed Files)

\`\`\`
$(git diff --stat "$START_OF_DAY".."$END_OF_DAY" 2>/dev/null | head -20 || echo "No changes")
\`\`\`

**Functions Modified (Top 10):**
\`\`\`
$(git log --since="$TODAY 00:00" --format="" --name-only | grep '\.ts$\|\.js$' | sort | uniq -c | sort -rn | head -10)
\`\`\`

---

## 💡 INSIGHTS & LEARNINGS

### Code Quality Patterns

**Functions with High Complexity (>10):**
\`\`\`
$(npm run analyze:functions 2>/dev/null | jq -r '.[] | select(.complexity > 10) | "\(.name) - Complexity: \(.complexity)"' 2>/dev/null | head -10 || echo "Run npm run analyze:functions")
\`\`\`

**Security Hotspots:**
\`\`\`
$(npm run analyze:security 2>/dev/null | jq -r '.[] | select(.severity == "high") | "\(.file):\(.line) - \(.message)"' 2>/dev/null | head -5 || echo "Run npm run analyze:security")
\`\`\`

### Technical Debt Introduced

**TODO/FIXME Comments Added:**
\`\`\`
$(git diff "$START_OF_DAY".."$END_OF_DAY" | grep -E '^\+.*TODO|^\+.*FIXME' || echo "None")
\`\`\`

**Deprecated Usage:**
\`\`\`
$(git diff "$START_OF_DAY".."$END_OF_DAY" | grep -E '^\+.*@deprecated' || echo "None")
\`\`\`

---

## 🎯 COPILOT EFFICIENCY ANALYSIS

### Token Usage Estimate

**Context Provided (estimated):**
- Files read: $(git log --since="$TODAY 00:00" --format="" --name-only | wc -l | tr -d ' ') files
- Avg file size: ~$(git diff "$START_OF_DAY".."$END_OF_DAY" --stat 2>/dev/null | awk '{sum+=$3; count++} END {if(count>0) print int(sum/count); else print 0}') lines
- Estimated tokens sent: ~$(git log --since="$TODAY 00:00" --format="" --name-only | wc -l | awk '{print int($1 * 500)}') tokens

**Iterations per Issue:**
\`\`\`
$(git log --since="$TODAY 00:00" --format='%s' | grep -E 'fix|feat|refactor' | wc -l | tr -d ' ') feature commits ÷ $COMMITS_TODAY total
\`\`\`

### Optimization Opportunities

**Redundant Operations (potential waste):**
- Multiple reads of same file: $(git log --since="$TODAY 00:00" --format='%s' | grep -i "read\|check\|verify" | wc -l | tr -d ' ') operations
- Repeated grep patterns: [Manual review recommended]

**Recommendations for Tomorrow:**
1. Pre-compute grep patterns: $(git log --since="$TODAY 00:00" --format='%s' | grep -c "grep\|search" | tr -d ' ' || echo "0") searches could be batched
2. Use diff-first approach: $(git log --since="$TODAY 00:00" --format='%s' | grep -c "modify\|update" | tr -d ' ' || echo "0") modifications could show diff instead of full file
3. Create test harnesses: $(git log --since="$TODAY 00:00" --format='%s' | grep -c "test\|verify" | tr -d ' ' || echo "0") verifications could be scripted

---

## 📋 ACTION ITEMS FOR TOMORROW

### High Priority
- [ ] Review and close completed issues in BACKLOG.md
- [ ] $([ "$ESLINT_ISSUES" -gt 0 ] 2>/dev/null && echo "Fix $ESLINT_ISSUES linting issues" || echo "✅ No linting issues")
- [ ] $([ "$PRETTIER_ISSUES" -gt 0 ] 2>/dev/null && echo "Format $PRETTIER_ISSUES files" || echo "✅ Code formatted")
- [ ] $(npm test -- --silent 2>&1 | grep -q "FAIL" && echo "Fix failing tests" || echo "✅ All tests passing")

### Code Quality
- [ ] Refactor functions with complexity > 10
- [ ] Add tests for new features (current coverage: $(echo "$COVERAGE" | grep -oP 'Statements.*:\s+\K[\d.]+%' || echo "N/A"))
- [ ] Document public APIs (JSDoc missing: $(grep -r "export function\|export class" src/ --include="*.ts" | wc -l) vs $(grep -r "/\*\*" src/ --include="*.ts" | wc -l))

### Documentation
- [ ] Update CHANGELOG.md with today's changes
- [ ] Review and update README.md if needed
- [ ] $([ -f "docs/project/ROADMAP.md" ] && echo "Update ROADMAP.md progress" || echo "Create ROADMAP.md")

---

## 🧠 KNOWLEDGE CAPTURE

### Patterns Discovered
[Manual entry - add insights from debugging sessions]

### Gotchas Encountered
[Manual entry - add surprises or unexpected behaviors]

### Reusable Solutions
\`\`\`bash
# Add any useful one-liners or scripts created today
$(git log --since="$TODAY 00:00" --format='%b' | grep -E '^# |^\$ ' | head -10)
\`\`\`

---

## 📈 TRENDS (Last 7 Days)

**Commit Velocity:**
\`\`\`
$(for i in {6..0}; do
  day=$(date -d "$i days ago" +%Y-%m-%d)
  count=$(git log --since="$day 00:00" --until="$day 23:59" --oneline | wc -l)
  echo "$day: $count commits"
done)
\`\`\`

**Coverage Trend:**
[Run weekly to track - add manual entry if available]

---

**🤖 Prompts for Copilot (Copy-Paste for Next Session)**

\`\`\`markdown
# Session Context (Quick Resume)

Yesterday's Focus: [Based on commit messages above]
Issues Closed: [List from BACKLOG]
Current Blockers: [If any]

Today's Plan:
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

Context to provide:
- Attach this debrief file
- Run: ./scripts/prepare-copilot-context.sh
- Include specific error logs if debugging
\`\`\`

---

**Generated:** $(date -Iseconds)
EOF

# ==============================================================================
# APPEND TO SESSION NOTES
# ==============================================================================

if [ -f "$SESSION_NOTES" ]; then
  echo "" >> "$SESSION_NOTES"
  echo "---" >> "$SESSION_NOTES"
  echo "" >> "$SESSION_NOTES"
fi

cat "$OUTPUT_FILE" >> "$SESSION_NOTES"

# ==============================================================================
# TERMINAL OUTPUT
# ==============================================================================

echo "✅ Debrief generated: $OUTPUT_FILE"
echo "✅ Appended to: $SESSION_NOTES"
echo ""
echo "📊 QUICK SUMMARY"
echo "════════════════"
echo "Commits Today:     $COMMITS_TODAY"
echo "Files Changed:     $FILES_CHANGED"
echo "Lines Added:       +$LINES_ADDED"
echo "Lines Removed:     -$LINES_REMOVED"
echo "Tests Added:       $TESTS_ADDED"
echo "Lint Issues:       $ESLINT_ISSUES"
echo ""
echo "🎯 TOP PRIORITIES FOR TOMORROW"
echo "═══════════════════════════════"

if [ "$ESLINT_ISSUES" -gt 0 ] 2>/dev/null; then
  echo "❗ Fix $ESLINT_ISSUES linting issues"
fi

if [ "$PRETTIER_ISSUES" -gt 0 ] 2>/dev/null; then
  echo "❗ Format $PRETTIER_ISSUES files"
fi

if npm test -- --silent 2>&1 | grep -q "FAIL"; then
  echo "❗ Fix failing tests"
fi

if [ "$(grep -c "Status.*Open" docs/project/BACKLOG.md 2>/dev/null || echo 0)" -gt 0 ]; then
  echo "📋 Review open issues in BACKLOG.md"
fi

echo ""
echo "💡 OPTIMIZATION TIPS FOR COPILOT"
echo "═════════════════════════════════"
SEARCH_OPS=$(git log --since="$TODAY 00:00" --format='%s' 2>/dev/null | { grep -c "grep\|search" || echo "0"; } 2>/dev/null)
READ_OPS=$(git log --since="$TODAY 00:00" --format='%s' 2>/dev/null | { grep -c "read\|check" || echo "0"; } 2>/dev/null)
TOKEN_EST=$(git log --since="$TODAY 00:00" --format="" --name-only 2>/dev/null | wc -l | awk '{print int($1 * 500)}')
echo "• $SEARCH_OPS search operations - consider pre-batching"
echo "• $READ_OPS file reads - use diff-first approach"
echo "• Estimated token usage today: ~$TOKEN_EST tokens"
echo ""
echo "🚀 Ready for tomorrow!"
echo ""
echo "📖 View full report: cat $OUTPUT_FILE"
echo "📋 View session notes: cat $SESSION_NOTES"
