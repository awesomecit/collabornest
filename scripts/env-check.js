#!/usr/bin/env node

/**
 * Environment Checker
 *
 * Verifica che l'ambiente di sviluppo rispetti i requisiti enterprise
 * per Node.js, npm e le dipendenze del progetto.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EnvironmentChecker {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  /**
   * Controlla la versione di Node.js
   */
  checkNodeVersion() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      const requiredNode = packageJson.engines?.node;

      if (!requiredNode) {
        this.results.warnings.push(
          '⚠️  No Node.js engine requirement specified',
        );
        return;
      }

      const currentNode = process.version;

      // Parse requirement (handle >=, ^, ~, exact)
      const cleanRequired = requiredNode.replace(/[>=^~\s]/g, '');
      const currentClean = currentNode.replace('v', '');

      const current = this.parseVersion(currentClean);
      const required = this.parseVersion(cleanRequired);

      if (this.compareVersions(current, required) >= 0) {
        this.results.passed.push(
          `✅ Node.js ${currentNode} meets requirement ${requiredNode}`,
        );
      } else {
        this.results.failed.push(
          `❌ Node.js ${currentNode} does not meet requirement ${requiredNode}`,
        );
      }
    } catch (error) {
      this.results.failed.push(
        `❌ Error checking Node.js version: ${error.message}`,
      );
    }
  }

  /**
   * Controlla la versione di npm
   */
  checkNpmVersion() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      const requiredNpm = packageJson.engines?.npm;

      if (!requiredNpm) {
        this.results.warnings.push('⚠️  No npm engine requirement specified');
        return;
      }

      const currentNpm = execSync('npm --version', { encoding: 'utf8' }).trim();

      // Parse requirement (handle >=, ^, ~, exact)
      const cleanRequired = requiredNpm.replace(/[>=^~\s]/g, '');

      const current = this.parseVersion(currentNpm);
      const required = this.parseVersion(cleanRequired);

      if (this.compareVersions(current, required) >= 0) {
        this.results.passed.push(
          `✅ npm ${currentNpm} meets requirement ${requiredNpm}`,
        );
      } else {
        this.results.failed.push(
          `❌ npm ${currentNpm} does not meet requirement ${requiredNpm}`,
        );
      }
    } catch (error) {
      this.results.failed.push(
        `❌ Error checking npm version: ${error.message}`,
      );
    }
  }

  /**
   * Controlla la presenza e consistenza del package-lock.json
   */
  checkPackageLock() {
    const packageLockPath = path.join(process.cwd(), 'package-lock.json');

    if (!fs.existsSync(packageLockPath)) {
      this.results.failed.push(
        '❌ package-lock.json not found - required for enterprise',
      );
      return;
    }

    try {
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8'),
      );
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

      if (packageJson.version !== packageLock.version) {
        this.results.failed.push(
          `❌ Version mismatch: package.json(${packageJson.version}) vs package-lock.json(${packageLock.version})`,
        );
      } else {
        this.results.passed.push(
          `✅ package-lock.json version ${packageLock.version} matches package.json`,
        );
      }

      // Check lockfile version
      if (packageLock.lockfileVersion >= 3) {
        this.results.passed.push(
          `✅ package-lock.json uses modern lockfile format v${packageLock.lockfileVersion}`,
        );
      } else {
        this.results.warnings.push(
          `⚠️  package-lock.json uses older lockfile format v${packageLock.lockfileVersion}`,
        );
      }
    } catch (error) {
      this.results.failed.push(
        `❌ Error reading package-lock.json: ${error.message}`,
      );
    }
  }

  /**
   * Controlla la configurazione Git per Husky
   */
  checkGitHooks() {
    try {
      const huskyPath = path.join(process.cwd(), '.husky');

      if (!fs.existsSync(huskyPath)) {
        this.results.warnings.push(
          '⚠️  Husky hooks not found - commit validation disabled',
        );
        return;
      }

      this.results.passed.push('✅ Husky Git hooks configured');

      // Check for specific hooks
      const hooks = ['pre-commit', 'commit-msg', 'pre-push'];
      hooks.forEach(hook => {
        const hookPath = path.join(huskyPath, hook);
        if (fs.existsSync(hookPath)) {
          this.results.passed.push(`✅ ${hook} hook configured`);
        }
      });
    } catch (error) {
      this.results.warnings.push(
        `⚠️  Error checking Git hooks: ${error.message}`,
      );
    }
  }

  /**
   * Controlla le vulnerabilità di sicurezza
   */
  checkSecurity() {
    try {
      execSync('npm audit --audit-level=high', { stdio: 'pipe' });
      this.results.passed.push('✅ No high-severity security vulnerabilities');
    } catch (error) {
      this.results.failed.push(
        '❌ High-severity security vulnerabilities found - run: npm audit',
      );
    }
  }

  /**
   * Parse delle versioni semantic
   */
  parseVersion(version) {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0] || 0),
      minor: parseInt(parts[1] || 0),
      patch: parseInt(parts[2] || 0),
    };
  }

  /**
   * Confronta due versioni
   */
  compareVersions(a, b) {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
  }

  /**
   * Esegue tutti i controlli
   */
  runAllChecks() {
    console.log('🔍 Checking development environment...\n');

    this.checkNodeVersion();
    this.checkNpmVersion();
    this.checkPackageLock();
    this.checkGitHooks();
    this.checkSecurity();

    this.printResults();
    return this.results.failed.length === 0;
  }

  /**
   * Stampa i risultati
   */
  printResults() {
    console.log('\n📋 Environment Check Results:\n');

    if (this.results.passed.length > 0) {
      console.log('✅ PASSED:');
      this.results.passed.forEach(msg => console.log(`   ${msg}`));
      console.log('');
    }

    if (this.results.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.warnings.forEach(msg => console.log(`   ${msg}`));
      console.log('');
    }

    if (this.results.failed.length > 0) {
      console.log('❌ FAILED:');
      this.results.failed.forEach(msg => console.log(`   ${msg}`));
      console.log('');
    }

    console.log(
      `📊 Summary: ${this.results.passed.length} passed, ${this.results.warnings.length} warnings, ${this.results.failed.length} failed\n`,
    );

    if (this.results.failed.length === 0) {
      console.log('🎉 Environment is ready for enterprise development!');
    } else {
      console.log('🚨 Environment setup needs attention before proceeding.');
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const checker = new EnvironmentChecker();
  checker.runAllChecks();
}

module.exports = EnvironmentChecker;
