import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';

describe('Database Integration - PostgreSQL Connection', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let configService: ConfigService;

  describe('PostgreSQL Connection via TypeORM', () => {
    describe('GIVEN a properly configured PostgreSQL database', () => {
      beforeAll(async () => {
        // GIVEN: Configure the application with database connection
        module = await Test.createTestingModule({
          imports: [
            // Environment configuration with validation
            ConfigModule.forRoot({
              isGlobal: true,
              load: [configuration],
              validationSchema,
              validationOptions: {
                allowUnknown: true,
                abortEarly: true,
              },
            }),
            // TypeORM connection - same as production
            TypeOrmModule.forRootAsync({
              imports: [ConfigModule],
              useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('database.host'),
                port: configService.get('database.port'),
                username: configService.get('database.username'),
                password: configService.get('database.password'),
                database: configService.get('database.name'),
                autoLoadEntities: true,
                synchronize: false, // Never auto-sync in tests
                logging: false, // Disable logging for cleaner test output
                retryAttempts: 3,
                retryDelay: 3000,
              }),
              inject: [ConfigService],
            }),
          ],
        }).compile();

        configService = module.get<ConfigService>(ConfigService);
        dataSource = module.get<DataSource>(getDataSourceToken());
      });

      afterAll(async () => {
        // Clean up connections
        if (dataSource && dataSource.isInitialized) {
          await dataSource.destroy();
        }
        if (module) {
          await module.close();
        }
      });

      describe('WHEN attempting to connect to PostgreSQL database', () => {
        it('THEN should successfully establish database connection', async () => {
          // WHEN: Check database connection
          const isConnected = dataSource.isInitialized;

          // THEN: Connection should be established
          expect(isConnected).toBe(true);
        });

        it('THEN should be able to execute basic SQL queries', async () => {
          // WHEN: Execute a simple query
          const result = await dataSource.query('SELECT 1 as test_value');

          // THEN: Query should return expected result
          expect(result).toBeDefined();
          expect(result[0].test_value).toBe(1);
        });

        it('THEN should load database configuration from environment namespace', async () => {
          // WHEN: Retrieve database configuration
          const dbHost = configService.get('database.host');
          const dbPort = configService.get('database.port');
          const dbName = configService.get('database.name');
          const dbUsername = configService.get('database.username');

          // THEN: Configuration should be loaded from namespace
          expect(dbHost).toBeDefined();
          expect(dbPort).toBeDefined();
          expect(dbName).toBeDefined();
          expect(dbUsername).toBeDefined();

          // THEN: Configuration should match expected types
          expect(typeof dbHost).toBe('string');
          expect(typeof dbPort).toBe('number');
          expect(typeof dbName).toBe('string');
          expect(typeof dbUsername).toBe('string');
        });

        it('THEN should validate required environment variables through Joi schema', async () => {
          // WHEN: Access critical database environment variables
          const requiredConfig = {
            host: configService.get('database.host'),
            port: configService.get('database.port'),
            username: configService.get('database.username'),
            password: configService.get('database.password'),
            name: configService.get('database.name'),
          };

          // THEN: All required config should be present and valid
          expect(requiredConfig.host).toBeTruthy();
          expect(requiredConfig.port).toBeGreaterThan(0);
          expect(requiredConfig.username).toBeTruthy();
          expect(requiredConfig.password).toBeTruthy();
          expect(requiredConfig.name).toBeTruthy();
        });
      });
    });
  });

  describe('Configuration Service Integration', () => {
    describe('GIVEN environment variables are loaded', () => {
      it('THEN should provide centralized configuration access', () => {
        // WHEN: Access configuration through ConfigService
        const nodeEnv = configService.get('nodeEnv');
        const port = configService.get('port');

        // THEN: Configuration should be accessible
        expect(nodeEnv).toBeDefined();
        expect(port).toBeDefined();
        expect(typeof port).toBe('number');
      });

      it('THEN should support nested namespace configuration', () => {
        // WHEN: Access nested database configuration
        const databaseConfig = {
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          name: configService.get('database.name'),
        };

        // THEN: All nested configuration should be accessible
        Object.values(databaseConfig).forEach(value => {
          expect(value).toBeDefined();
          expect(value).not.toBe('');
        });
      });
    });
  });
});
