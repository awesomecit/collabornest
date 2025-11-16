import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { IncomingHttpHeaders } from 'http';
import * as path from 'path';
import { CustomLogger } from '../logger/logger.service';

// Definiamo tipi specifici per rendere il codice type-safe
interface ErrorLogData {
  method: string;
  url: string;
  status: number;
  message: string;
  timestamp: string;
  userAgent: string;
  ip: string;
}

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  errors?: Record<string, any>;
}

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  method: string;
  errors?: Record<string, any>;
  stack?: string;
}

interface ErrorResponseContext {
  exception: unknown;
  request: Request;
  status: number;
  message: string | string[];
  errors?: Record<string, unknown>;
}

interface ErrorContext {
  exception: unknown;
  request: Request;
  status: number;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: CustomLogger) {}

  /**
   * Helper per verificare se un header dovrebbe essere aggiunto
   */
  private shouldIncludeHeader(key: string): boolean {
    return key !== 'host' && key !== 'connection';
  }

  /**
   * Helper per aggiungere headers al comando curl
   */
  private addHeadersToCurl(
    headers: IncomingHttpHeaders,
    curlCommand: string,
  ): string {
    if (!headers || typeof headers !== 'object') {
      return curlCommand;
    }

    let result = curlCommand;

    for (const key in headers) {
      if (this.isValidHeaderProperty(headers, key)) {
        result = this.addSingleHeader(headers, key, result);
      }
    }

    return result;
  }

  private isValidHeaderProperty(
    headers: IncomingHttpHeaders,
    key: string,
  ): boolean {
    return (
      Object.prototype.hasOwnProperty.call(headers, key) &&
      this.shouldIncludeHeader(key)
    );
  }

  private addSingleHeader(
    headers: IncomingHttpHeaders,
    key: string,
    result: string,
  ): string {
    const value = headers[key];
    return value !== undefined
      ? `${result} -H '${key}: ${String(value)}'`
      : result;
  }

  /**
   * Helper per aggiungere body al comando curl
   */
  private addBodyToCurl(body: unknown, curlCommand: string): string {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return curlCommand;
    }

    let result = curlCommand + ` -H 'Content-Type: application/json'`;

    try {
      const safeBody: Record<string, unknown> = {};
      for (const key of Object.keys(body)) {
        safeBody[key] = (body as Record<string, unknown>)[key];
      }

      const bodyStr = JSON.stringify(safeBody, (_key, value): unknown => {
        return value === undefined ? null : value;
      });

      result += ` -d '${bodyStr}'`;
    } catch {
      result += ` -d '{}'`;
    }

    return result;
  }

  private generateCurlCommand(request: Request): string {
    const method = request.method;
    const url = request.url;
    const headers = request.headers;
    const body: unknown = request.body;

    // Base URL from request
    const host = headers.host || 'localhost';
    const protocol = request.secure ? 'https' : 'http';
    const fullUrl = `${protocol}://${host}${url}`;

    // Initialize the curl command
    let curlCommand = `curl -X ${method} '${fullUrl}'`;

    // Add headers using helper
    curlCommand = this.addHeadersToCurl(headers, curlCommand);

    // Add body using helper
    curlCommand = this.addBodyToCurl(body, curlCommand);

    return curlCommand;
  }

  private logToSentryFile(
    exception: unknown,
    request: Request,
    status: number,
    message: string | string[],
  ): void {
    try {
      const logDir = path.resolve(process.cwd(), 'logs');

      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Ottieni la data formattata per il nome del file (YYYY-MM-DD)
      const today = new Date();
      const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Crea il nome del file con la data
      const logFilePath = path.join(logDir, `sentry-${dateString}.log`);

      // Prepare log data
      const timestamp = new Date().toISOString();
      const curlCommand = this.generateCurlCommand(request);

      // Funzione per rimuovere i codici di colore ANSI
      const stripAnsiCodes = (str: string): string => {
        return str.replace(new RegExp('\u001b' + '\\[\\d+m', 'g'), '');
      };

      // Prepare log content with explicit typing
      const logEntry: Record<string, unknown> = {
        timestamp,
        status,
        message: Array.isArray(message) ? message.join(', ') : message,
        path: request.url,
        method: request.method,
        userAgent: request.get('User-Agent') || 'Unknown',
        ip: request.ip || 'Unknown',
        requestBody: request.body,
        requestQuery: request.query,
        requestParams: request.params,
        curlCommand,
        stack:
          exception instanceof Error
            ? stripAnsiCodes(exception.stack || '')
            : 'No stack trace available',
      };

      // Convert to string format and add a new line
      const logString = JSON.stringify(logEntry, null, 2) + '\n\n';

      // Append to file
      fs.appendFileSync(logFilePath, logString, 'utf8');
    } catch (error) {
      this.logger.error(
        `Failed to write to sentry.log: ${error instanceof Error ? error.message : String(error)}`,
        'ExceptionFilter',
      );
    }
  }

  /**
   * Helper per gestire HttpException specificamente
   */
  private handleHttpException(exception: HttpException): {
    status: number;
    message: string | string[];
    errors?: Record<string, unknown>;
  } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    return this.processHttpExceptionResponse(
      status,
      exceptionResponse,
      exception.message,
    );
  }

  private processHttpExceptionResponse(
    status: number,
    exceptionResponse: string | object,
    fallbackMessage: string,
  ): {
    status: number;
    message: string | string[];
    errors?: Record<string, unknown>;
  } {
    if (typeof exceptionResponse === 'string') {
      return { status, message: exceptionResponse };
    }

    if (typeof exceptionResponse !== 'object' || exceptionResponse === null) {
      return { status, message: fallbackMessage };
    }

    return this.handleObjectResponse(
      status,
      exceptionResponse as HttpExceptionResponse,
      fallbackMessage,
    );
  }

  private handleObjectResponse(
    status: number,
    typedResponse: HttpExceptionResponse,
    fallbackMessage: string,
  ): {
    status: number;
    message: string | string[];
    errors?: Record<string, unknown>;
  } {
    const baseResult = {
      status,
      message: typedResponse.message || fallbackMessage,
    };

    if (status === HttpStatus.BAD_REQUEST && typedResponse.message) {
      return this.handleValidationError(baseResult, typedResponse);
    }

    return {
      ...baseResult,
      errors: typedResponse.errors as Record<string, unknown>,
    };
  }

  private handleValidationError(
    baseResult: { status: number; message: string | string[] },
    typedResponse: HttpExceptionResponse,
  ): {
    status: number;
    message: string | string[];
    errors?: Record<string, unknown>;
  } {
    if (Array.isArray(typedResponse.message)) {
      return {
        ...baseResult,
        message: 'Errori di validazione',
        errors: {
          validationErrors: typedResponse.message,
          details: 'Controlla i campi indicati e riprova',
          ...(typedResponse.errors as Record<string, unknown>),
        },
      };
    }

    return {
      ...baseResult,
      errors: typedResponse.errors as Record<string, unknown>,
    };
  }

  /**
   * Estrae lo status e il messaggio dall'eccezione
   */
  private extractExceptionDetails(exception: unknown): {
    status: number;
    message: string | string[];
    errors?: Record<string, unknown>;
  } {
    // Gestione specifica per HttpException con type guards
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    // Gestione per Error generici
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
      };
    }

    // Fallback per eccezioni sconosciute
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  /**
   * Gestisce il logging dell'eccezione in base alla sua gravità
   */
  private handleErrorLogging(errorContext: ErrorContext): void {
    const { exception, request, status, message } = errorContext;

    // Prepariamo i dati di log in modo type-safe
    const errorLogData: ErrorLogData = {
      method: request.method,
      url: request.url,
      status,
      message: Array.isArray(message) ? message.join(', ') : message,
      timestamp: new Date().toISOString(),
      userAgent: request.get('User-Agent') || 'Unknown',
      ip: request.ip || 'Unknown',
    };

    // Log dell'errore con informazioni complete
    const logMessage = `${errorLogData.method} ${errorLogData.url} - ${status} - ${errorLogData.message}`;

    // Facciamo il confronto in modo type-safe convertendo entrambi i valori allo stesso tipo
    const serverErrorThreshold = HttpStatus.INTERNAL_SERVER_ERROR; // 500
    if (status >= serverErrorThreshold) {
      this.logger.error(
        logMessage,
        exception instanceof Error
          ? exception.stack
          : 'No stack trace available',
        'ExceptionFilter',
      );

      // Salva i dettagli dell'errore nel file sentry.log per errori server
      this.logToSentryFile(exception, request, status, message);
    } else {
      this.logger.warn(logMessage, 'ExceptionFilter');
    }
  }

  /**
   * Prepara la risposta di errore da inviare al client
   */
  private prepareErrorResponse(context: ErrorResponseContext): ErrorResponse {
    const { exception, request, status, message, errors } = context;

    // Response standardizzata con tipizzazione forte
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Aggiungiamo errori se presenti
    if (errors) {
      errorResponse.errors = errors;
    }

    // Stack trace solo in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack;
    }

    return errorResponse;
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Estrai i dettagli dell'eccezione
    const { status, message, errors } = this.extractExceptionDetails(exception);

    // Gestisci il logging
    this.handleErrorLogging({ exception, request, status, message });

    // Prepara e invia la risposta
    const errorResponse = this.prepareErrorResponse({
      exception,
      request,
      status,
      message,
      errors,
    });

    response.status(status).json(errorResponse);
  }
}
