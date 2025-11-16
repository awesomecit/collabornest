import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

// Helper functions per il safe stringify
function handlePrimitives(value: unknown): string | null {
  // Caso base: se è già una stringa, restituiscila così com'è
  if (typeof value === 'string') {
    return value;
  }

  // Gestione esplicita di null e undefined per evitare confusione
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }

  // Per numeri, boolean e altri primitivi, la conversione standard è perfetta
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return `${value}`;
  }

  return null;
}

function handleSpecialObjects(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  // Gestione speciale per array: li rendiamo leggibili
  if (Array.isArray(value)) {
    try {
      return `[${value.map(item => safeStringify(item)).join(', ')}]`;
    } catch {
      return '[Array]';
    }
  }

  // Per Error objects, vogliamo il message e possibilmente lo stack
  if (value instanceof Error) {
    return value.stack || value.message || 'Error';
  }

  // Per Date objects, vogliamo una rappresentazione ISO
  if (value instanceof Date) {
    return value.toISOString();
  }

  return null;
}

function handleGenericObject(value: unknown): string {
  try {
    return tryJsonStringify(value);
  } catch {
    return fallbackObjectRepresentation(value);
  }
}

function tryJsonStringify(value: unknown): string {
  const jsonString = JSON.stringify(value, null, 2);
  return jsonString.length > 500
    ? `${jsonString.substring(0, 500)}...`
    : jsonString;
}

function fallbackObjectRepresentation(value: unknown): string {
  try {
    const keys = Object.keys(value as Record<string, unknown>);
    return `{Object with keys: ${keys.join(', ')}}`;
  } catch {
    return getConstructorName(value);
  }
}

function getConstructorName(value: unknown): string {
  if (value && typeof value === 'object' && 'constructor' in value) {
    const constructor = value.constructor;
    if (constructor && typeof constructor === 'function' && constructor.name) {
      return `[${constructor.name}]`;
    }
  }
  return '[Object]';
}

// Helper function avanzata per convertire valori unknown in stringhe meaningful
function safeStringify(value: unknown): string {
  // Prima controlla i primitivi
  const primitiveResult = handlePrimitives(value);
  if (primitiveResult !== null) {
    return primitiveResult;
  }

  // Poi controlla oggetti speciali
  const specialObjectResult = handleSpecialObjects(value);
  if (specialObjectResult !== null) {
    return specialObjectResult;
  }

  // Per oggetti, facciamo uno sforzo extra per renderli utili
  if (typeof value === 'object') {
    return handleGenericObject(value);
  }

  // Per function e symbol, forniamo una rappresentazione sensata
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  // Fallback finale per qualsiasi caso edge che non abbiamo coperto
  return `[Unrecognized value of type: ${typeof value}]`;
}

// Formatter per il timestamp con timezone configurabile
const timestampWithTimezone = (timezone: string) => {
  return winston.format(info => {
    // Ottieni l'ora corrente
    const date = new Date();

    // Formato base UTC
    const utcTime = date.toISOString();

    try {
      // Ottieni l'orario nella timezone specificata
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      };

      // Formatta la data nella timezone specificata
      const timeInZone = new Intl.DateTimeFormat('it-IT', options).format(date);

      // Aggiungi entrambi i formati al timestamp
      info.timestamp = `${utcTime} (${timeInZone})`;
    } catch {
      // Fallback se la timezone non è valida
      info.timestamp = `${utcTime} (timezone error: ${timezone})`;
    }

    return info;
  })();
};

@Injectable()
export class CustomLogger implements LoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    const config = this.getLoggerConfig();
    const formats = this.createLogFormats(config.timezone);
    const transports = this.createTransports(config, formats);

    this.logger = winston.createLogger({
      level: config.logLevel,
      transports,
    });

    this.logger.info(
      `Logger initialized with environment: ${config.nodeEnv}, timezone: ${config.timezone}, level: ${config.logLevel}`,
    );
  }

  /**
   * Ottiene la configurazione del logger dal ConfigService
   */
  private getLoggerConfig() {
    const nodeEnv = this.getConfigValue('NODE_ENV', 'development');

    return {
      nodeEnv,
      logLevel: this.getLogConfigValue(
        'level',
        nodeEnv,
        nodeEnv === 'production' ? 'info' : 'debug',
      ),
      maxFiles: this.getLogConfigValue('maxFiles', nodeEnv, '14d'),
      maxSize: this.getLogConfigValue('maxSize', nodeEnv, '20m'),
      timezone: this.getLogConfigValue('timezone', nodeEnv, 'Europe/Rome'),
    };
  }

  private getConfigValue(key: string, defaultValue: string): string {
    return (
      this.configService.get<string>(key) || process.env[key] || defaultValue
    );
  }

  private getLogConfigValue(
    configKey: string,
    nodeEnv: string,
    defaultValue: string,
  ): string {
    return (
      this.configService.get<string>(`logging.${nodeEnv}.${configKey}`) ||
      this.configService.get<string>(`logging.${configKey}`) ||
      defaultValue
    );
  }

  /**
   * Crea i formati per file e console
   */
  private createLogFormats(timezone: string) {
    const timestampFormat = timestampWithTimezone(timezone);

    const fileFormat = winston.format.combine(
      timestampFormat,
      winston.format.uncolorize(),
      winston.format.errors({ stack: true }),
      winston.format.printf(info => {
        const timestamp =
          typeof info.timestamp === 'string'
            ? info.timestamp
            : new Date().toISOString();
        const level = typeof info.level === 'string' ? info.level : 'info';
        const message = safeStringify(info.message);
        const context = info.context
          ? ` {"context":"${safeStringify(info.context)}",`
          : ' {';
        const stack = info.stack
          ? `, "stack":"${safeStringify(info.stack)}"`
          : '';

        return `[${timestamp}][${level}]: ${message}${context}"timestamp":"${timestamp}"${stack}}`;
      }),
    );

    const consoleFormat = winston.format.combine(
      timestampFormat,
      winston.format.errors({ stack: true }),
      winston.format.colorize(),
      winston.format.printf(info => {
        const timestamp =
          typeof info.timestamp === 'string'
            ? info.timestamp
            : new Date().toISOString();
        const level = typeof info.level === 'string' ? info.level : 'info';
        const message = safeStringify(info.message);
        const context = info.context ? `[${safeStringify(info.context)}] ` : '';
        const stack = info.stack ? `\n${safeStringify(info.stack)}` : '';

        return `[${timestamp}][${level}]: ${context}${message}${stack}`;
      }),
    );

    return { fileFormat, consoleFormat };
  }

  /**
   * Crea i transport per il logger
   */
  private createTransports(
    config: {
      nodeEnv: string;
      logLevel: string;
      maxFiles: string;
      maxSize: string;
    },
    formats: {
      fileFormat: winston.Logform.Format;
      consoleFormat: winston.Logform.Format;
    },
  ): winston.transport[] {
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: formats.consoleFormat,
        level:
          config.nodeEnv === 'production'
            ? config.logLevel || 'warn'
            : config.logLevel,
      }),
    ];

    // In production e staging aggiungiamo sempre i file di log
    if (config.nodeEnv !== 'test') {
      transports.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxFiles: config.maxFiles,
          maxSize: config.maxSize,
          format: formats.fileFormat,
        }),

        new winston.transports.DailyRotateFile({
          filename: 'logs/combined-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: config.maxFiles,
          maxSize: config.maxSize,
          format: formats.fileFormat,
        }),
      );
    }

    return transports;
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, stack?: string, context?: string): void {
    this.logger.error(message, { stack, context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  // Properly implement info method, which is the same as log in this implementation
  info(message: string, context?: string): void {
    this.logger.info(message, { context });
  }
}
