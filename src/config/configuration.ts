/**
 * Helper function to get environment variable with fallback
 * Reduces cognitive complexity by eliminating repeated ternary operations
 */
const getEnvVar = (key: string, fallback: string): string => {
  const value = process.env[key];
  return value && value !== '' ? value : fallback;
};

/**
 * Helper function to get environment variable as integer with fallback
 * Reduces cognitive complexity by eliminating repeated parsing logic
 */
const getEnvInt = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) return fallback;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Configuration factory with reduced cognitive complexity
 * Extracted helper functions to minimize branching logic
 */
export default () => ({
  port: getEnvInt('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'test'),
  database: {
    enabled: getEnvVar('DATABASE_ENABLED', 'false') === 'true',
    host: getEnvVar('DATABASE_HOST', 'localhost'),
    port: getEnvInt('DATABASE_PORT', 5432),
    username: getEnvVar('DATABASE_USERNAME', 'postgres'),
    password: getEnvVar('DATABASE_PASSWORD', 'password'),
    name: getEnvVar('DATABASE_NAME', 'database_app'),
  },
  jwt: {
    secret: getEnvVar('JWT_SECRET', 'your-secret-key'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', '1d'),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    maxFiles: getEnvVar('LOG_MAX_FILES', '14d'),
    maxSize: getEnvVar('LOG_MAX_SIZE', '20m'),
    timezone: getEnvVar('LOG_TIMEZONE', 'Europe/Rome'),
  },
});
