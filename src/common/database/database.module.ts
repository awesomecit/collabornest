import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Database configuration module
 * Centralizes TypeORM configuration following Single Responsibility Principle
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseConfig = {
          type: 'postgres' as const,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          autoLoadEntities: true,
          synchronize: configService.get('nodeEnv') === 'development',
          logging: configService.get('nodeEnv') === 'development',
          retryAttempts: 3,
          retryDelay: 3000,
        };

        // Validate critical configuration
        if (
          !databaseConfig.host ||
          !databaseConfig.database ||
          !databaseConfig.username
        ) {
          throw new Error(
            'Critical database configuration missing. Check environment variables.',
          );
        }

        return databaseConfig;
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
