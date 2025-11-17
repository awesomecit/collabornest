#!/usr/bin/env node
/**
 * BDD Test Configuration
 * Centralized timeouts, retries, and environment-specific settings
 */

const TEST_CONFIG = {
  // Connection timeouts
  connection: {
    timeout: parseInt(process.env.TEST_CONNECTION_TIMEOUT) || 5000,
    retries: parseInt(process.env.TEST_CONNECTION_RETRIES) || 3,
  },

  // Event waiting timeouts
  events: {
    default: parseInt(process.env.TEST_EVENT_TIMEOUT) || 3000,
    slow: parseInt(process.env.TEST_EVENT_TIMEOUT_SLOW) || 10000,
    critical: parseInt(process.env.TEST_EVENT_TIMEOUT_CRITICAL) || 15000,
  },

  // Wait times between operations
  waits: {
    short: parseInt(process.env.TEST_WAIT_SHORT) || 100,
    medium: parseInt(process.env.TEST_WAIT_MEDIUM) || 500,
    long: parseInt(process.env.TEST_WAIT_LONG) || 1000,
  },

  // Retry configuration
  retry: {
    maxAttempts: parseInt(process.env.TEST_RETRY_MAX) || 3,
    backoffMs: parseInt(process.env.TEST_RETRY_BACKOFF) || 1000,
    exponential: process.env.TEST_RETRY_EXPONENTIAL === 'true',
  },

  // WebSocket configuration
  websocket: {
    url: process.env.WS_URL || 'http://localhost:3000/collaboration',
    path: process.env.WS_PATH || '/ws/socket.io',
    transports: ['websocket'],
    reconnection: false,
  },

  // JWT configuration
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'your_super_secure_jwt_secret_32_characters_minimum',
    issuer: process.env.JWT_ISSUER || 'collabornest',
    audience: process.env.JWT_AUDIENCE || 'collabornest-users',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  // Debug mode
  debug: process.env.TEST_DEBUG === 'true',
};

module.exports = TEST_CONFIG;
