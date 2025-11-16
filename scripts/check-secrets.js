#!/usr/bin/env node

/**
 * Pre-commit secret scanner
 * Prevents committing sensitive data (API keys, passwords, tokens)
 *
 * Usage: node scripts/check-secrets.js [files...]
 * Exit codes:
 *   0 - No secrets found
 *   1 - Secrets detected (blocks commit)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Patterns to detect (high entropy strings, common secret formats)
const SECRET_PATTERNS = [
  // API Keys and Tokens
  { pattern: /([a-zA-Z0-9_-]{32,})/, name: 'Long alphanumeric string (potential API key)', severity: 'high' },
  { pattern: /(sk|pk)_live_[a-zA-Z0-9]{24,}/, name: 'Stripe live key', severity: 'critical' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key', severity: 'critical' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token', severity: 'critical' },
  { pattern: /gho_[a-zA-Z0-9]{36}/, name: 'GitHub OAuth Token', severity: 'critical' },
  { pattern: /glpat-[a-zA-Z0-9_-]{20,}/, name: 'GitLab Personal Access Token', severity: 'critical' },
  
  // Private Keys
  { pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/, name: 'Private Key', severity: 'critical' },
  { pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/, name: 'PGP Private Key', severity: 'critical' },
  
  // JWT (only flag real-looking ones, not test tokens)
  { pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, name: 'JWT Token', severity: 'medium' },
  
  // Database URLs with credentials
  { pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/, name: 'Database URL with credentials', severity: 'high' },
  
  // Generic secrets (but exclude test/example values) - case insensitive
  { pattern: /(password|passwd|pwd|PASSWORD|PASSWD|PWD)\s*[:=]\s*["'](?!password|test|example|changeme|your_password_here)[^"']{8,}["']/, name: 'Hardcoded password', severity: 'high' },
  { pattern: /(api_key|apikey|API_KEY|APIKEY)\s*[:=]\s*["'](?!your-api-key|test-key|example)[^"']{16,}["']/, name: 'Hardcoded API key', severity: 'high' },
  { pattern: /(secret|token|SECRET|TOKEN)\s*[:=]\s*["'](?!test-secret|your-secret|example)[^"']{16,}["']/, name: 'Hardcoded secret/token', severity: 'high' },
];

// Files/patterns to exclude from scanning
const EXCLUDED_PATTERNS = [
  /node_modules\//,
  /\.git\//,
  /coverage\//,
  /dist\//,
  /\.log$/,
  /\.lock$/,
  /package-lock\.json$/,
  /pnpm-lock\.yaml$/,
  /yarn\.lock$/,
  /\.env\.example$/,
  /\.env\.template$/,
  /check-secrets\.js$/,  // Don't scan this file itself
];

// Known safe values (whitelist)
const SAFE_VALUES = [
  'test-secret',
  'your-api-key',
  'example',
  'changeme',
  'CHANGE_ME_IN_PRODUCTION',
  'GENERATE_RANDOM_32_CHAR_SECRET',
  'password',
  'secure_password_change_me',
  'this_is_a_very_long_test_jwt_secret_key_with_32_chars_minimum',
];

function shouldExcludeFile(filePath) {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath));
}

function isSafeValue(value) {
  return SAFE_VALUES.some(safe => value.includes(safe));
}

function scanFile(filePath) {
  const findings = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      SECRET_PATTERNS.forEach(({ pattern, name, severity }) => {
        const matches = line.match(pattern);
        if (matches) {
          const matchedValue = matches[0];
          
          // Skip if it's a safe/test value
          if (isSafeValue(matchedValue)) {
            return;
          }
          
          // Skip if it's in a comment explaining the pattern
          if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
            return;
          }
          
          findings.push({
            file: filePath,
            line: index + 1,
            severity,
            type: name,
            snippet: line.trim().substring(0, 80),
          });
        }
      });
    });
  } catch (error) {
    // Skip binary files or unreadable files
    if (error.code !== 'ENOENT') {
      console.warn(`⚠️  Could not read file: ${filePath}`);
    }
  }
  
  return findings;
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    // Not a git repo or no staged files
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  let filesToScan = args.length > 0 ? args : getStagedFiles();
  
  // If no files provided and not in git, scan all tracked files
  if (filesToScan.length === 0) {
    console.log('ℹ️  No staged files found, scanning all files...');
    try {
      const output = execSync('git ls-files', { encoding: 'utf-8' });
      filesToScan = output.trim().split('\n').filter(Boolean);
    } catch {
      console.error('❌ Not in a git repository');
      process.exit(1);
    }
  }
  
  // Filter out excluded files
  filesToScan = filesToScan.filter(file => !shouldExcludeFile(file));
  
  console.log(`🔍 Scanning ${filesToScan.length} files for secrets...\n`);
  
  const allFindings = [];
  
  filesToScan.forEach(file => {
    const findings = scanFile(file);
    allFindings.push(...findings);
  });
  
  if (allFindings.length === 0) {
    console.log('✅ No secrets detected - safe to commit\n');
    process.exit(0);
  }
  
  // Group by severity
  const critical = allFindings.filter(f => f.severity === 'critical');
  const high = allFindings.filter(f => f.severity === 'high');
  const medium = allFindings.filter(f => f.severity === 'medium');
  
  console.error('❌ SECRETS DETECTED - COMMIT BLOCKED\n');
  
  if (critical.length > 0) {
    console.error(`🚨 CRITICAL (${critical.length}):`);
    critical.forEach(f => {
      console.error(`   ${f.file}:${f.line} - ${f.type}`);
      console.error(`   ${f.snippet}`);
      console.error('');
    });
  }
  
  if (high.length > 0) {
    console.error(`⚠️  HIGH (${high.length}):`);
    high.forEach(f => {
      console.error(`   ${f.file}:${f.line} - ${f.type}`);
      console.error(`   ${f.snippet}`);
      console.error('');
    });
  }
  
  if (medium.length > 0) {
    console.error(`ℹ️  MEDIUM (${medium.length}):`);
    medium.forEach(f => {
      console.error(`   ${f.file}:${f.line} - ${f.type}`);
      console.error(`   ${f.snippet}`);
      console.error('');
    });
  }
  
  console.error('Fix these issues before committing:');
  console.error('1. Remove hardcoded secrets');
  console.error('2. Use environment variables (.env)');
  console.error('3. Add values to .env.example as placeholders\n');
  console.error('If these are false positives, add them to SAFE_VALUES in scripts/check-secrets.js\n');
  
  process.exit(1);
}

main();
