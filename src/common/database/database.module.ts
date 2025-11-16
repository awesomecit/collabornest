import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Database configuration module (optional loading)
 * Centralizes TypeORM configuration following Single Responsibility Principle
 *
 * Usage:
 * - Set DATABASE_ENABLED=true to enable PostgreSQL connection
 * - Set DATABASE_ENABLED=false to skip database (for WebSocket-only mode, BDD tests)
 */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const databaseEnabled = process.env.DATABASE_ENABLED === 'true';

    if (!databaseEnabled) {
      return this.createDisabledModule();
    }

    return this.createEnabledModule();
  }

  /**
   * Create module WITHOUT TypeORM (WebSocket-only mode)
   */
  private static createDisabledModule(): DynamicModule {
    console.log(
      '[Database] ⏭️  Database disabled (DATABASE_ENABLED !== "true")',
    );
    console.log('[Database] 💡 To enable: Set DATABASE_ENABLED=true in .env');
    console.log('[Database] 🚀 Running in WebSocket-only mode');

    return {
      module: DatabaseModule,
      imports: [ConfigModule],
      exports: [],
    };
  }

  /**
   * Create module WITH TypeORM (database enabled)
   */
  private static createEnabledModule(): DynamicModule {
    console.log('[Database] ✅ Database enabled, initializing TypeORM...');

    return {
      module: DatabaseModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const databaseConfig = {
              type: 'postgres' as const,
              host: configService.get<string>('database.host', 'localhost'),
              port: configService.get<number>('database.port', 5432),
              username: configService.get<string>(
                'database.username',
                'postgres',
              ),
              password: configService.get<string>('database.password', ''),
              database: configService.get<string>(
                'database.name',
                'collabornest',
              ),
              autoLoadEntities: true,
              synchronize: configService.get('nodeEnv') === 'development',
              logging: configService.get('nodeEnv') === 'development',
              retryAttempts: 3,
              retryDelay: 3000,
            };

            console.log(
              `[Database] 🔌 Connecting to PostgreSQL at ${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`,
            );
            return databaseConfig;
          },
          inject: [ConfigService],
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
