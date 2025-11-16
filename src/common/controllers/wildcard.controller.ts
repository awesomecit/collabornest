import { Controller, Get, Param, All } from '@nestjs/common';
import { CustomLogger } from '../logger/logger.service';

// Importante: non usiamo il decoratore @Controller() vuoto ma specifichiamo il percorso esatto
// per evitare che il prefisso globale venga applicato automaticamente
@Controller('api/v1')
export class WildcardController {
  constructor(private readonly logger: CustomLogger) {}

  // Gestiamo correttamente il percorso wildcard usando la sintassi corretta *path
  @All('*path')
  handleApiWildcard(@Param('path') path: string) {
    // Path sarà già la parte dopo /api/v1/
    this.logger.warn(
      `Richiesta a percorso API non gestito: ${path || 'root'}`,
      'WildcardController',
    );
    return {
      message: 'Percorso API non trovato',
      path: path ? `/api/v1/${path}` : '/api/v1',
      availableEndpoints: ['/api/v1/health'],
      documentation:
        'Per la documentazione completa delle API, contatta il team di sviluppo',
    };
  }

  // Route di fallback per la root API
  @Get()
  handleApiRoot() {
    this.logger.info('Accesso alla root API', 'WildcardController');
    return {
      message: 'API REST NestJS',
      version: '1.0.0',
      availableEndpoints: ['/api/v1/health'],
      documentation:
        'Per la documentazione completa delle API, contatta il team di sviluppo',
    };
  }
}

// Controller separato per gestire le richieste fuori dal prefisso API
@Controller()
export class RootWildcardController {
  constructor(private readonly logger: CustomLogger) {}

  @All('health')
  handleHealthCheck() {
    this.logger.info(
      'Redirecting health check from root to /api/v1/health',
      'RootWildcardController',
    );
    return {
      message: "Per usare l'health check, vai a /api/v1/health",
    };
  }

  @All('*path') // <-- Sintassi corretta con parametro nominato
  handleAll(@Param('path') path: string) {
    this.logger.warn(
      `Richiesta a percorso non API: ${path || 'root'}`,
      'RootWildcardController',
    );
    return {
      message: 'Percorso non trovato',
      path: `/${path || ''}`,
      suggestion: 'Le API sono disponibili su /api/v1',
    };
  }
}
