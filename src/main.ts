// Carica le variabili d'ambiente PRIMA di qualsiasi import
// L'utente può modificare DATABASE_ENABLED nel .env per abilitare/disabilitare il database
import * as dotenv from 'dotenv';
dotenv.config();

import {
  INestApplication,
  NestInterceptor,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logger.interceptors';
import { TransformInterceptor } from './common/interceptors/transform.interceptors';
import { CustomLogger } from './common/logger/logger.service';
import { setupSwagger } from './swagger/swagger.config';

/**
 * Configura CORS per l'applicazione
 */
function setupCors(app: INestApplication, logger: CustomLogger): void {
  const corsOrigin = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  logger.log(
    `🌐 CORS enabled for origins: ${corsOrigin.join(', ')}`,
    'Bootstrap',
  );
}

/**
 * Configura il prefisso globale per le API e le esclusioni
 */
function setupGlobalPrefix(
  app: INestApplication,
  logger: CustomLogger,
): string {
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      // Escludi il controller wildcard root che ha già il suo path
      { path: '/', method: RequestMethod.ALL },
      // Importante: escludi il controller wildcard API che definisce già il suo prefisso
      { path: 'api/v1', method: RequestMethod.ALL },
      { path: 'api/v1/*path', method: RequestMethod.ALL }, // Sintassi corretta con parametro nominato
      // Escludi health endpoint per renderlo accessibile direttamente
      { path: 'health', method: RequestMethod.ALL },
      // Escludi api-docs per Swagger UI
      { path: 'api-docs', method: RequestMethod.ALL },
      { path: 'api-docs/*path', method: RequestMethod.ALL },
    ],
  });
  logger.log(`🛣️  Global API prefix set to: /${globalPrefix}`, 'Bootstrap');
  logger.log(
    `⚠️  Note: Excluded from prefix: /, /api/v1/*, /health, /api-docs/*`,
    'Bootstrap',
  );

  return globalPrefix;
}

/**
 * Configura i pipe globali
 */
function setupGlobalPipes(app: INestApplication, logger: CustomLogger): void {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Trasforma automaticamente i tipi
      whitelist: true, // Rimuove proprietà non definite nel DTO
      forbidNonWhitelisted: true, // Lancia errore per proprietà non definite
      transformOptions: {
        enableImplicitConversion: true, // Conversioni automatiche
      },
    }),
  );
  logger.log('✅ Global validation pipe configured', 'Bootstrap');
}

/**
 * Configura i filtri e gli interceptor globali
 */
function setupGlobalFiltersAndInterceptors(
  app: INestApplication,
  logger: CustomLogger,
): void {
  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  logger.log('🛡️  Global exception filter enabled', 'Bootstrap');

  // Global interceptors
  const loggingInterceptor = new LoggingInterceptor(logger) as NestInterceptor;
  const transformInterceptor = new TransformInterceptor() as NestInterceptor;

  app.useGlobalInterceptors(loggingInterceptor, transformInterceptor);
  logger.log(
    '📡 Global interceptors configured (Logging + Transform)',
    'Bootstrap',
  );
}

/**
 * Visualizza i log finali con informazioni sull'applicazione avviata
 */
function logApplicationStartInfo(
  logger: CustomLogger,
  port: number,
  globalPrefix: string,
): void {
  logger.log(`🎉 Application successfully started!`, 'Bootstrap');
  logger.log(
    `🌍 Server running on: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(
    `📋 Health check: http://localhost:${port}/health`, // Senza prefix
    'Bootstrap',
  );
  logger.log(
    `🔍 API endpoints: http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
  logger.log(
    `📝 Swagger documentation: http://localhost:${port}/api-docs`, // Senza prefix
    'Bootstrap',
  );

  // Log delle rotte disponibili
  logger.log('📍 Available routes:', 'Bootstrap');
  logger.log(
    `GET  /${globalPrefix}/health- Health check endpoint`,
    'Bootstrap',
  );
  logger.log(
    `GET  /${globalPrefix}/*path - API endpoints handler`,
    'Bootstrap',
  );
}

async function bootstrap(): Promise<void> {
  // Creiamo l'app con il logger di default per il bootstrap, poi lo sostituiremo
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logger = app.get(CustomLogger);

  // Logging dettagliato del processo di bootstrap
  logger.log('🚀 Starting NestJS application...', 'Bootstrap');
  logger.log(`📊 Environment: ${configService.get('nodeEnv')}`, 'Bootstrap');
  logger.log(
    `🔧 Log Level: ${configService.get('logging.level')}`,
    'Bootstrap',
  );

  // Ora sostituiamo il logger di default con il nostro
  app.useLogger(logger);

  // Configurazione delle varie parti dell'applicazione
  setupCors(app, logger);
  const globalPrefix = setupGlobalPrefix(app, logger);
  setupGlobalPipes(app, logger);
  setupGlobalFiltersAndInterceptors(app, logger);

  // Configurazione Swagger
  const port = configService.get<number>('port') || 3000;
  setupSwagger(app, logger, port);
  logger.log('📚 Swagger documentation initialized at /api-docs', 'Bootstrap');

  // Enable graceful shutdown hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();
  logger.log(
    '🛑 Graceful shutdown hooks enabled (SIGTERM, SIGINT)',
    'Bootstrap',
  );

  // Avvio del server
  await app.listen(port);

  // Log delle informazioni finali
  logApplicationStartInfo(logger, port, globalPrefix);
}

bootstrap().catch((error: unknown) => {
  const errorMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';
  console.error('❌ Failed to start application:', errorMessage);
  process.exit(1);
});
