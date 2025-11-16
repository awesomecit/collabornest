import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { CustomLogger } from '../common/logger/logger.service';

export function setupSwagger(
  app: INestApplication,
  logger: CustomLogger,
  port: number = 3000,
): OpenAPIObject {
  const options = buildSwaggerOptions(port);
  const document = createSwaggerDocument(app, options, logger);
  setupSwaggerUI(app, document);

  logger.log('Swagger documentation available', 'Swagger');
  return document;
}

function buildSwaggerOptions(port: number) {
  return new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('Documentazione completa delle API del backend')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('api', 'Endpoints API principali')
    .addTag('health', 'Controlli di salute del sistema')
    .addServer(`http://localhost:${port}`)
    .build();
}

function createSwaggerDocument(
  app: INestApplication,
  options: Omit<OpenAPIObject, 'paths'>,
  logger: CustomLogger,
): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, options, {
    deepScanRoutes: true,
    ignoreGlobalPrefix: false,
  });

  addHealthEndpointIfMissing(document, logger);
  return document;
}

function addHealthEndpointIfMissing(
  document: OpenAPIObject,
  logger: CustomLogger,
): void {
  if (!document.paths['/health']) {
    logger.warn('Health endpoint non trovato in Swagger', 'Swagger');
    document.paths['/health'] = {
      get: {
        tags: ['health'],
        summary: "Controlla lo stato di salute dell'applicazione",
        responses: {
          '200': { description: "L'applicazione è in salute" },
          '503': { description: 'Uno o più servizi non sono disponibili' },
        },
        parameters: [],
      },
    };
  }
}

function setupSwaggerUI(app: INestApplication, document: OpenAPIObject): void {
  SwaggerModule.setup('api-docs', app, document, {
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });
}
