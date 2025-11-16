import { Global, Module } from '@nestjs/common';
import { CustomLogger } from './logger.service';

/**
 * Modulo globale per il CustomLogger
 * Questo modulo rende il CustomLogger disponibile in tutta l'applicazione
 * senza doverlo importare in ogni singolo modulo
 */
@Global()
@Module({
  providers: [CustomLogger],
  exports: [CustomLogger],
})
export class LoggerModule {}
