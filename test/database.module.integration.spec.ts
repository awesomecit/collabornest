import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../src/common/database/database.module';
import configuration from '../src/config/configuration';
import { validationSchema } from '../src/config/validation.schema';

describe('DatabaseModule Integration', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  describe('Database Module Configuration', () => {
    describe('GIVEN DatabaseModule is properly configured', () => {
      beforeAll(async () => {
        // GIVEN: Setup DatabaseModule with configuration
        module = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [configuration],
              validationSchema,
              validationOptions: {
                allowUnknown: true,
                abortEarly: true,
              },
            }),
            DatabaseModule,
          ],
        }).compile();

        dataSource = module.get<DataSource>(getDataSourceToken());
      });

      afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
          await dataSource.destroy();
        }
        if (module) {
          await module.close();
        }
      });

      describe('WHEN DatabaseModule initializes', () => {
        it('THEN should provide a configured DataSource', () => {
          // WHEN: DatabaseModule is initialized
          // THEN: DataSource should be available and configured
          expect(dataSource).toBeDefined();
          expect(dataSource.isInitialized).toBe(true);
        });

        it('THEN should configure PostgreSQL as database type', () => {
          // WHEN: Check database type
          const driverType = dataSource.options.type;

          // THEN: Should be configured as PostgreSQL
          expect(driverType).toBe('postgres');
        });

        it('THEN should enable auto-load entities', () => {
          // WHEN: Check entity auto-loading configuration
          const autoLoadEntities = (dataSource.options as any).autoLoadEntities;

          // THEN: Auto-load should be enabled
          expect(autoLoadEntities).toBe(true);
        });

        it('THEN should have retry configuration for resilience', () => {
          // WHEN: Check retry configuration
          const options = dataSource.options as any;

          // THEN: Should have retry attempts configured
          expect(options.retryAttempts).toBe(3);
          expect(options.retryDelay).toBe(3000);
        });
      });
    });
  });

  describe('Database Module Error Handling', () => {
    describe('GIVEN missing critical database configuration', () => {
      it('THEN should throw meaningful error during initialization', async () => {
        // GIVEN: Configuration without required database settings
        const invalidConfigModule = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({
              isGlobal: true,
              load: [
                () => ({
                  // Missing database configuration
                  nodeEnv: 'test',
                  port: 3000,
                }),
              ],
              validationOptions: {
                allowUnknown: true,
                abortEarly: false, // Allow to see all validation errors
              },
            }),
          ],
        }).compile();

        // WHEN & THEN: Should throw validation error due to missing config
        await expect(async () => {
          await Test.createTestingModule({
            imports: [
              ConfigModule.forRoot({
                isGlobal: true,
                load: [
                  () => ({
                    nodeEnv: 'test',
                    port: 3000,
                    // Missing database configuration
                  }),
                ],
                validationSchema,
                validationOptions: {
                  allowUnknown: true,
                  abortEarly: true,
                },
              }),
              DatabaseModule,
            ],
          }).compile();
        }).rejects.toThrow();
      });
    });
  });
});
