/**
 * BDD Scenario Executor - Helper Functions
 *
 * Provides Gherkin-style assertion helpers and logging utilities
 * for BDD test scenarios.
 *
 * Usage:
 * ```javascript
 * const { given, when, then, scenario, feature } = require('./scenario-executor');
 *
 * feature('User Authentication');
 * scenario('Valid JWT token');
 * given('a valid JWT token', () => { ... });
 * when('user connects to WebSocket', () => { ... });
 * then('connection should be established', () => { ... });
 * ```
 */

class ScenarioExecutor {
  constructor() {
    this.currentFeature = null;
    this.currentScenario = null;
    this.stepNumber = 0;
    this.failures = [];
  }

  /**
   * Declare a feature (top-level grouping)
   * @param {string} name - Feature name
   */
  feature(name) {
    this.currentFeature = name;
    console.log(`\n🎯 Feature: ${name}`);
    console.log('═'.repeat(80));
  }

  /**
   * Declare a scenario within a feature
   * @param {string} name - Scenario name
   */
  scenario(name) {
    this.currentScenario = name;
    this.stepNumber = 0;
    console.log(`\n  📌 Scenario: ${name}`);
    console.log('  ' + '─'.repeat(76));
  }

  /**
   * Execute a GIVEN step (precondition)
   * @param {string} description - Step description
   * @param {Function} fn - Async step implementation
   */
  async given(description, fn) {
    return this._executeStep('GIVEN', description, fn);
  }

  /**
   * Execute a WHEN step (action)
   * @param {string} description - Step description
   * @param {Function} fn - Async step implementation
   */
  async when(description, fn) {
    return this._executeStep('WHEN', description, fn);
  }

  /**
   * Execute a THEN step (assertion)
   * @param {string} description - Step description
   * @param {Function} fn - Async step implementation
   */
  async then(description, fn) {
    return this._executeStep('THEN', description, fn);
  }

  /**
   * Execute an AND step (continuation)
   * @param {string} description - Step description
   * @param {Function} fn - Async step implementation
   */
  async and(description, fn) {
    return this._executeStep('AND', description, fn);
  }

  /**
   * Internal: Execute a step with error handling
   */
  async _executeStep(keyword, description, fn) {
    this.stepNumber++;
    const stepId = `${this.stepNumber}`.padStart(2, '0');

    try {
      console.log(`    ${stepId}. ${keyword} ${description}`);
      await fn();
      console.log(`        ✓ Passed`);
    } catch (err) {
      console.error(`        ✗ Failed: ${err.message}`);
      this.failures.push({
        feature: this.currentFeature,
        scenario: this.currentScenario,
        step: `${keyword} ${description}`,
        error: err.message,
        stack: err.stack,
      });
      throw err; // Re-throw to fail the scenario
    }
  }

  /**
   * Assert equality with descriptive error
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Optional assertion message
   */
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      const error = new Error(
        `${message}\n       Expected: ${JSON.stringify(expected)}\n       Actual:   ${JSON.stringify(actual)}`,
      );
      throw error;
    }
  }

  /**
   * Assert truthy with descriptive error
   * @param {*} value - Value to check
   * @param {string} message - Optional assertion message
   */
  assertTrue(value, message = 'Expected truthy value') {
    if (!value) {
      throw new Error(`${message}\n       Actual: ${JSON.stringify(value)}`);
    }
  }

  /**
   * Assert object contains expected properties
   * @param {Object} actual - Actual object
   * @param {Object} expected - Expected properties subset
   */
  assertContains(actual, expected) {
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) {
        throw new Error(
          `Property "${key}" mismatch\n       Expected: ${value}\n       Actual:   ${actual[key]}`,
        );
      }
    }
  }

  /**
   * Wait for specified milliseconds (for async timing)
   * @param {number} ms - Milliseconds to wait
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log debug information
   * @param {string} label - Log label
   * @param {*} data - Data to log
   */
  log(label, data) {
    console.log(`        💬 ${label}:`, JSON.stringify(data, null, 2));
  }

  /**
   * Get test failures (for summary)
   */
  getFailures() {
    return this.failures;
  }

  /**
   * Check if all tests passed
   */
  hasPassed() {
    return this.failures.length === 0;
  }

  /**
   * Print final summary
   */
  printSummary() {
    console.log('\n' + '═'.repeat(80));
    if (this.hasPassed()) {
      console.log('✅ All scenarios passed');
    } else {
      console.log(`❌ ${this.failures.length} scenario(s) failed:`);
      this.failures.forEach((f, i) => {
        console.log(`\n  ${i + 1}. ${f.feature} > ${f.scenario}`);
        console.log(`     Step: ${f.step}`);
        console.log(`     Error: ${f.error}`);
      });
    }
    console.log('═'.repeat(80) + '\n');
  }
}

// Singleton instance
const executor = new ScenarioExecutor();

module.exports = {
  feature: executor.feature.bind(executor),
  scenario: executor.scenario.bind(executor),
  given: executor.given.bind(executor),
  when: executor.when.bind(executor),
  then: executor.then.bind(executor),
  and: executor.and.bind(executor),
  assertEqual: executor.assertEqual.bind(executor),
  assertTrue: executor.assertTrue.bind(executor),
  assertContains: executor.assertContains.bind(executor),
  wait: executor.wait.bind(executor),
  log: executor.log.bind(executor),
  getExecutor: () => executor,
};
