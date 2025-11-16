#!/usr/bin/env node
/**
 * BDD Test Runner for CollaborNest WebSocket Gateway
 *
 * Purpose: Execute BDD-style tests with real Socket.IO clients and log output
 * Format: Gherkin-compatible scenarios mapped to EPIC-001 requirements
 * Output: Console logs + HTML report for UI team reference
 *
 * Usage:
 *   npm run test:bdd              # Run all BDD tests
 *   npm run test:bdd:connection   # Run BE-001.1 only
 *   npm run test:bdd:presence     # Run BE-001.2 only
 *   npm run test:bdd:report       # Generate HTML report
 *
 * Why not Jest?
 * - Jest hides important debug logs during test execution
 * - BDD tests need full visibility into WebSocket events
 * - UI team needs readable logs to understand backend behavior
 * - Report generation needs custom Gherkin formatting
 *
 * Architecture:
 * - test-runner.js: Orchestrates test execution, aggregates results
 * - scenario-executor.js: Runs individual scenarios with logging
 * - report-generator.js: Produces HTML report from test results
 * - be001-X-*.test.js: Test files with scenario implementations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class BDDTestRunner {
  constructor() {
    this.results = [];
    this.testFiles = [];
    this.startTime = Date.now();
  }

  /**
   * Discover test files in scripts/bdd-tests/
   * @param {string} pattern - Optional pattern to filter tests (e.g., 'connection')
   */
  discoverTests(pattern = null) {
    const testsDir = __dirname;
    const files = fs.readdirSync(testsDir);

    this.testFiles = files
      .filter(f => f.endsWith('.test.js'))
      .filter(f => !pattern || f.includes(pattern))
      .map(f => path.join(testsDir, f));

    console.log(`\n🔍 Discovered ${this.testFiles.length} test file(s):`);
    this.testFiles.forEach(f => console.log(`   - ${path.basename(f)}`));
    console.log('');

    return this.testFiles;
  }

  /**
   * Execute a single test file
   * @param {string} filePath - Absolute path to test file
   * @returns {Promise<Object>} Test result with scenarios and logs
   */
  async executeTestFile(filePath) {
    return new Promise((resolve, reject) => {
      const fileName = path.basename(filePath);
      console.log(`\n📋 Running: ${fileName}`);
      console.log('─'.repeat(80));

      const testProcess = spawn('node', [filePath], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' },
      });

      testProcess.on('close', code => {
        const result = {
          file: fileName,
          exitCode: code,
          success: code === 0,
          duration: Date.now() - this.startTime,
        };

        if (code === 0) {
          console.log(`✅ ${fileName} passed\n`);
        } else {
          console.error(`❌ ${fileName} failed with exit code ${code}\n`);
        }

        resolve(result);
      });

      testProcess.on('error', err => {
        console.error(`❌ Error executing ${fileName}:`, err.message);
        reject(err);
      });
    });
  }

  /**
   * Run all discovered tests sequentially
   */
  async runAll() {
    console.log('\n🚀 CollaborNest BDD Test Suite');
    console.log('━'.repeat(80));
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Test files: ${this.testFiles.length}`);
    console.log('━'.repeat(80));

    for (const testFile of this.testFiles) {
      try {
        const result = await this.executeTestFile(testFile);
        this.results.push(result);
      } catch (err) {
        this.results.push({
          file: path.basename(testFile),
          exitCode: 1,
          success: false,
          error: err.message,
        });
      }
    }

    this.printSummary();
    return this.results;
  }

  /**
   * Print test execution summary
   */
  printSummary() {
    const duration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log('\n━'.repeat(80));
    console.log('📊 BDD Test Summary');
    console.log('━'.repeat(80));
    console.log(`Total:    ${this.results.length} test file(s)`);
    console.log(`Passed:   ${passed} ✅`);
    console.log(`Failed:   ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Time:     ${new Date().toISOString()}`);
    console.log('━'.repeat(80));

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.file} (exit code: ${r.exitCode})`));
    }

    console.log('\n💡 Tip: Run individual test suites with:');
    console.log('   npm run test:bdd:connection');
    console.log('   npm run test:bdd:presence');
    console.log('\n📄 Generate HTML report with:');
    console.log('   npm run test:bdd:report\n');
  }

  /**
   * Get exit code for process (0 if all passed, 1 if any failed)
   */
  getExitCode() {
    return this.results.some(r => !r.success) ? 1 : 0;
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const pattern = args[0]; // Optional filter (e.g., 'connection', 'presence')

  const runner = new BDDTestRunner();
  runner.discoverTests(pattern);

  runner
    .runAll()
    .then(() => {
      process.exit(runner.getExitCode());
    })
    .catch(err => {
      console.error('\n💥 Fatal error:', err);
      process.exit(1);
    });
}

module.exports = BDDTestRunner;
