import configuration from './configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Backup degli env originali e reset per ogni test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Ripristina le variabili d'ambiente originali
    process.env = originalEnv;
  });

  it('should return default configuration when no env variables are set', () => {
    // Elimina tutte le variabili rilevanti per il test
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_USERNAME;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_NAME;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_MAX_FILES;
    delete process.env.LOG_MAX_SIZE;
    delete process.env.LOG_TIMEZONE;

    const config = configuration();

    // Verifica dei valori predefiniti
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test');
    expect(config.database).toEqual({
      enabled: false,
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      name: 'database_app',
    });
    expect(config.jwt).toEqual({
      secret: 'your-secret-key',
      expiresIn: '1d',
    });
    expect(config.logging).toEqual({
      level: 'info',
      maxFiles: '14d',
      maxSize: '20m',
      timezone: 'Europe/Rome',
    });
  });

  it('should use environment variables when provided', () => {
    // Imposta le variabili d'ambiente
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_HOST = 'db.example.com';
    process.env.DATABASE_PORT = '5433';
    process.env.DATABASE_USERNAME = 'testuser';
    process.env.DATABASE_PASSWORD = 'testpassword';
    process.env.DATABASE_NAME = 'testdb';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '2h';
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_MAX_FILES = '30d';
    process.env.LOG_MAX_SIZE = '50m';
    process.env.LOG_TIMEZONE = 'America/New_York';

    const config = configuration();

    // Verifica che i valori vengano presi dalle variabili d'ambiente
    expect(config.port).toBe(4000);
    expect(config.nodeEnv).toBe('production');
    expect(config.database).toEqual({
      enabled: false,
      host: 'db.example.com',
      port: 5433,
      username: 'testuser',
      password: 'testpassword',
      name: 'testdb',
    });
    expect(config.jwt).toEqual({
      secret: 'test-secret',
      expiresIn: '2h',
    });
    expect(config.logging).toEqual({
      level: 'debug',
      maxFiles: '30d',
      maxSize: '50m',
      timezone: 'America/New_York',
    });
  });

  it('should handle invalid port number in environment variable', () => {
    process.env.PORT = 'not-a-number';
    process.env.DATABASE_PORT = 'invalid';

    const config = configuration();

    // Dovrebbe usare i valori predefiniti per valori non validi
    expect(config.port).toBe(3000);
    expect(config.database.port).toBe(5432);
  });

  it('should handle empty environment variables', () => {
    process.env.PORT = '';
    process.env.NODE_ENV = '';
    process.env.DATABASE_HOST = '';
    process.env.DATABASE_PORT = '';
    process.env.DATABASE_USERNAME = '';
    process.env.DATABASE_PASSWORD = '';
    process.env.DATABASE_NAME = '';
    process.env.JWT_SECRET = '';
    process.env.JWT_EXPIRES_IN = '';
    process.env.LOG_LEVEL = '';
    process.env.LOG_MAX_FILES = '';
    process.env.LOG_MAX_SIZE = '';
    process.env.LOG_TIMEZONE = '';

    const config = configuration();

    // Verifica dei valori predefiniti quando le variabili sono vuote
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test');
    expect(config.database).toEqual({
      enabled: false,
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      name: 'database_app',
    });
    expect(config.jwt).toEqual({
      secret: 'your-secret-key',
      expiresIn: '1d',
    });
    expect(config.logging).toEqual({
      level: 'info',
      maxFiles: '14d',
      maxSize: '20m',
      timezone: 'Europe/Rome',
    });
  });
});
