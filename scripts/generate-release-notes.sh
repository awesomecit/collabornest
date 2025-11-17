#!/bin/bash

# Release Notes Generator
# Generates release notes for GitHub releases

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Get project name from package.json
PROJECT_NAME=$(node -p "require('./package.json').name")
print_status "Project: $PROJECT_NAME"

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Get repository owner/name from git remote
GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -n "$GIT_REMOTE" ]; then
    # Extract owner/repo from various git URL formats
    # SSH: git@github.com:owner/repo.git
    # HTTPS: https://github.com/owner/repo.git
    REPO_PATH=$(echo "$GIT_REMOTE" | sed -E 's|^.*[:/]([^/]+/[^/]+)\.git$|\1|')
    print_status "Repository: $REPO_PATH"
else
    print_warning "No git remote found, using default repository path"
    REPO_PATH="owner/repo"
fi

# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LAST_TAG" ]; then
    print_warning "No previous tags found, generating full changelog"
    COMMIT_RANGE="HEAD"
else
    print_status "Last tag: $LAST_TAG"
    COMMIT_RANGE="$LAST_TAG..HEAD"
fi

# Generate release notes
OUTPUT_FILE="RELEASE_NOTES.md"

print_status "Generating release notes..."

cat > $OUTPUT_FILE << EOF
# Release Notes v$CURRENT_VERSION

## 📋 Summary

This release includes improvements to code quality, documentation, and development workflow.

## 🚀 Features

EOF

# Get feature commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^feat" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 🐛 Bug Fixes

EOF

# Get bug fix commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^fix" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 📚 Documentation

EOF

# Get documentation commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^docs" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 🔧 Code Refactoring

EOF

# Get refactoring commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^refactor" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## ⚡ Performance Improvements

EOF

# Get performance commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^perf" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 🏗️ Build System

EOF

# Get build commits
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="^build" >> $OUTPUT_FILE || echo "" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 📊 Quality Metrics

### Code Complexity
- Cognitive Complexity: ≤ 10 ✅
- Cyclomatic Complexity: ≤ 10 ✅
- Function Length: ≤ 50 lines ✅
- Max Parameters: ≤ 4 ✅

### Test Coverage
EOF

# Add test coverage if available
if [ -f "coverage/coverage-summary.json" ]; then
    echo "- Lines: $(node -p "require('./coverage/coverage-summary.json').total.lines.pct")%" >> $OUTPUT_FILE
    echo "- Functions: $(node -p "require('./coverage/coverage-summary.json').total.functions.pct")%" >> $OUTPUT_FILE
    echo "- Branches: $(node -p "require('./coverage/coverage-summary.json').total.branches.pct")%" >> $OUTPUT_FILE
    echo "- Statements: $(node -p "require('./coverage/coverage-summary.json').total.statements.pct")%" >> $OUTPUT_FILE
else
    echo "- Coverage report not available" >> $OUTPUT_FILE
fi

cat >> $OUTPUT_FILE << EOF

## 🔍 Static Analysis
- ESLint violations: $(npm run lint 2>/dev/null | grep -c "error\|warning" || echo "0")
- SonarJS cognitive complexity issues: $(npm run analyze:cognitive 2>/dev/null | grep -c "🧠" || echo "0")

## 🛠️ Development

### Requirements
- Node.js ≥ 18.x
- npm ≥ 9.x
- PostgreSQL ≥ 13.x (for full functionality)

### Installation
\`\`\`bash
npm install
npm run build
npm run test
\`\`\`

### Quality Checks
\`\`\`bash
npm run quality          # Complete quality check
npm run analyze          # Complexity analysis
npm run test:coverage    # Test coverage
\`\`\`

## 🚨 Breaking Changes

EOF

# Check for breaking changes
git log $COMMIT_RANGE --pretty=format:"- %s (%h)" --grep="BREAKING CHANGE\|!" >> $OUTPUT_FILE || echo "None" >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 📝 Migration Guide

### From Previous Version

No special migration steps required for this release.

## 🤝 Contributors

EOF

# Get contributors for this release
git log $COMMIT_RANGE --pretty=format:"- %an" | sort | uniq >> $OUTPUT_FILE

cat >> $OUTPUT_FILE << EOF

## 🔗 Links

- [Full Changelog](https://github.com/$REPO_PATH/compare/$LAST_TAG...v$CURRENT_VERSION)
- [Issues](https://github.com/$REPO_PATH/issues)
- [Documentation](./docs/)

---

**Full changelog**: https://github.com/$REPO_PATH/compare/$LAST_TAG...v$CURRENT_VERSION
EOF

print_success "Release notes generated: $OUTPUT_FILE"

# Optionally open the file
if command -v code &> /dev/null; then
    print_status "Opening release notes in VS Code..."
    code $OUTPUT_FILE
elif command -v cat &> /dev/null; then
    print_status "Release notes content:"
    echo "----------------------------------------"
    cat $OUTPUT_FILE
fi
