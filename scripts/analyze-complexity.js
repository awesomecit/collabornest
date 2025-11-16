#!/usr/bin/env node

/**
 * Cognitive Complexity Analyzer
 *
 * Analyzes TypeScript source files for cognitive complexity issues
 * using ESLint with SonarJS plugin.
 *
 * Usage:
 *   node scripts/analyze-complexity.js [--type=TYPE] [--json]
 *
 * Types:
 *   cognitive - Cognitive complexity (sonarjs/cognitive-complexity)
 *   cyclomatic - Cyclomatic complexity (complexity)
 *   functions - Long functions (max-lines-per-function)
 *   security - Security issues (eslint-plugin-security)
 *   all - All types (default)
 *
 * Flags:
 *   --json - Output in JSON format
 *   --silent - Only output if issues found
 */

const { ESLint } = require('eslint');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const typeArg = args.find(arg => arg.startsWith('--type='));
const analysisType = typeArg ? typeArg.split('=')[1] : 'all';
const jsonOutput = args.includes('--json');
const silent = args.includes('--silent');

// Rule mappings
const RULES = {
  cognitive: 'sonarjs/cognitive-complexity',
  cyclomatic: 'complexity',
  functions: 'max-lines-per-function',
  security: /^security\//,
  params: 'max-params',
  depth: 'max-depth',
  statements: 'max-statements',
};

async function analyzeComplexity() {
  try {
    const eslint = new ESLint();
    const results = await eslint.lintFiles(['src/**/*.ts']);

    // Filter issues based on analysis type
    const issues = results.flatMap(result => {
      const filteredMessages = result.messages.filter(message => {
        if (analysisType === 'all') {
          return Object.values(RULES).some(rule => {
            if (rule instanceof RegExp) {
              return rule.test(message.ruleId);
            }
            return message.ruleId === rule;
          });
        }

        const rule = RULES[analysisType];
        if (rule instanceof RegExp) {
          return rule.test(message.ruleId);
        }
        return message.ruleId === rule;
      });

      return filteredMessages.map(message => ({
        file: path.relative(process.cwd(), result.filePath),
        line: message.line,
        column: message.column,
        ruleId: message.ruleId,
        severity: message.severity === 2 ? 'error' : 'warning',
        message: message.message,
      }));
    });

    // Output results
    if (jsonOutput) {
      outputJSON(issues);
    } else {
      outputFormatted(issues);
    }

    // Exit with error code if issues found
    process.exit(issues.length > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error analyzing complexity:', error.message);
    process.exit(1);
  }
}

function outputJSON(issues) {
  const stats = {
    total: issues.length,
    byType: {},
    byFile: {},
    issues,
  };

  // Aggregate by rule type
  issues.forEach(issue => {
    stats.byType[issue.ruleId] = (stats.byType[issue.ruleId] || 0) + 1;
    stats.byFile[issue.file] = (stats.byFile[issue.file] || 0) + 1;
  });

  console.log(JSON.stringify(stats, null, 2));
}

function outputFormatted(issues) {
  if (issues.length === 0) {
    if (!silent) {
      console.log(
        `\nNo ${analysisType === 'all' ? 'complexity' : analysisType} issues found\n`,
      );
    }
    return;
  }

  console.log(
    `\nFound ${issues.length} ${analysisType === 'all' ? 'complexity' : analysisType} issue(s):\n`,
  );

  // Group by file
  const byFile = {};
  issues.forEach(issue => {
    if (!byFile[issue.file]) {
      byFile[issue.file] = [];
    }
    byFile[issue.file].push(issue);
  });

  // Print grouped results
  Object.entries(byFile).forEach(([file, fileIssues]) => {
    console.log(`\n${file}:`);
    fileIssues.forEach(issue => {
      const icon = getIcon(issue.ruleId);
      const severity = issue.severity === 'error' ? 'ERROR' : 'WARN';
      console.log(
        `  ${icon} Line ${issue.line}:${issue.column} [${severity}] ${issue.message}`,
      );
    });
  });

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(
    `Summary: ${issues.length} issue(s) across ${Object.keys(byFile).length} file(s)`,
  );

  const byType = {};
  issues.forEach(issue => {
    byType[issue.ruleId] = (byType[issue.ruleId] || 0) + 1;
  });

  console.log('\nBy Type:');
  Object.entries(byType).forEach(([rule, count]) => {
    const icon = getIcon(rule);
    console.log(`  ${icon} ${rule}: ${count}`);
  });
  console.log();
}

function getIcon(ruleId) {
  if (ruleId.includes('cognitive-complexity')) return '[COGNITIVE]';
  if (ruleId === 'complexity') return '[CYCLOMATIC]';
  if (ruleId.includes('max-lines')) return '[FUNCTION-LENGTH]';
  if (ruleId.includes('security')) return '[SECURITY]';
  if (ruleId.includes('max-params')) return '[PARAMS]';
  if (ruleId.includes('max-depth')) return '[DEPTH]';
  if (ruleId.includes('max-statements')) return '[STATEMENTS]';
  return '[QUALITY]';
}

// Run analysis
analyzeComplexity().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
