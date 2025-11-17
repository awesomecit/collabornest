#!/usr/bin/env node

/**
 * Generate test JWT tokens for UI team testing
 *
 * Usage:
 *   node scripts/generate-test-jwt.js
 *   node scripts/generate-test-jwt.js --userId "test-user-123" --username "Dr. John Smith"
 *
 * Output: Valid JWT token that can be used in complete-reports-test.html
 */

const jwt = require('jsonwebtoken');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

// Default test user data
const userId = getArg('--userId', 'test-user-123');
const username = getArg('--username', 'Dr. John Smith');
const email = getArg('--email', 'john.smith@hospital.it');
const ttl = parseInt(getArg('--ttl', '3600'), 10); // 1 hour default

// Get JWT_SECRET from environment or use default for testing
const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-change-in-production';

// Generate JWT payload
const payload = {
  sub: userId, // User ID (standard JWT claim)
  username: username, // Display name
  email: email, // Email address
  iat: Math.floor(Date.now() / 1000), // Issued at (current time)
  exp: Math.floor(Date.now() / 1000) + ttl, // Expiration (1 hour from now)
};

// Sign token
const token = jwt.sign(payload, JWT_SECRET, {
  algorithm: 'HS256',
});

// Decode for verification
const decoded = jwt.decode(token);

// Output results
console.log('\n🎫 Test JWT Token Generated\n');
console.log('─────────────────────────────────────────────────────────');
console.log('Token:');
console.log(token);
console.log('─────────────────────────────────────────────────────────');
console.log('\n📋 Token Details:\n');
console.log(`User ID:      ${decoded.sub}`);
console.log(`Username:     ${decoded.username}`);
console.log(`Email:        ${decoded.email}`);
console.log(`Issued At:    ${new Date(decoded.iat * 1000).toISOString()}`);
console.log(`Expires At:   ${new Date(decoded.exp * 1000).toISOString()}`);
console.log(`Valid For:    ${ttl} seconds (${Math.floor(ttl / 60)} minutes)`);
console.log('─────────────────────────────────────────────────────────');

console.log('\n📝 Usage in HTML Test File:\n');
console.log('```javascript');
console.log('// Replace generateJWT() with this:');
console.log('function getTestJWT() {');
console.log(`  return '${token}';`);
console.log('}');
console.log('```');

console.log(
  '\n⚠️  Note: This token is for TESTING ONLY. Do NOT use in production.\n',
);
console.log('💡 To generate custom token:');
console.log(
  '   node scripts/generate-test-jwt.js --userId "user-456" --username "Nurse Jane"\n',
);
