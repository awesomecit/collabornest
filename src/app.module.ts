import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import {
  RootWildcardController,
  WildcardController,
} from './common/controllers/wildcard.controller';
import { DatabaseModule } from './common/database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from './common/logger/logger.module';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { HealthController } from './health/health.controller';
import { WebSocketGatewayModule } from './websocket-gateway/websocket-gateway.module';

@Module({
  imports: [
    // Configurazione ambiente con validazione
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests per minuto
      },
    ]),

    // Database (optional - controlled by DATABASE_ENABLED env var)
    DatabaseModule.forRoot(),

    // Logger globale
    LoggerModule,

    // Health checks
    TerminusModule,

    // WebSocket Gateway for real-time collaboration
    WebSocketGatewayModule,

    // Feature modules - add your modules here
    // Example: UsersModule, ProductsModule, etc.
  ],
  controllers: [
    HealthController,
    AppController,
    WildcardController,
    RootWildcardController,
  ],
  providers: [
    // Validation pipe globale
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // Rimuove proprietà non definite nei DTO
        forbidNonWhitelisted: true, // Lancia errore se ci sono proprietà non whitelisted
        transform: true, // Trasforma automaticamente i tipi
        validateCustomDecorators: true, // Valida decoratori custom
        transformOptions: {
          enableImplicitConversion: true, // Conversione automatica dei tipi
        },
      }),
    },
    // Rate limiting guard globale
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Applica middleware di sicurezza a tutte le routes
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
