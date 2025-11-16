import { Injectable } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Opzioni per la validazione DTO
 */
export interface DtoValidationOptions {
  /** Abilita la validazione del DTO usando class-validator */
  enableValidation?: boolean;
  /** Abilita la trasformazione del DTO usando class-transformer */
  enableTransformation?: boolean;
  /** Personalizza il messaggio di errore */
  errorPrefix?: string;
  /** Opzioni aggiuntive per class-validator */
  validatorOptions?: {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    transform?: boolean;
  };
}

/**
 * Risultato della validazione DTO
 */
export interface DtoValidationResult<T> {
  /** Dati validati e trasformati */
  data: T;
  /** Errori di validazione (se presenti) */
  errors?: ValidationError[];
  /** Indica se la validazione è passata */
  isValid: boolean;
}

/**
 * Servizio generico per la validazione e trasformazione di DTO
 * utilizzando class-validator e class-transformer
 */
@Injectable()
export class DtoValidatorService {
  /**
   * Valida e trasforma un oggetto usando un DTO class
   *
   * @param dtoClass - La classe DTO da utilizzare per la validazione
   * @param data - I dati da validare
   * @param options - Opzioni per la validazione
   * @returns I dati validati e trasformati
   * @throws Error se la validazione fallisce
   */
  async validateAndTransform<T extends object>(
    dtoClass: ClassConstructor<T>,
    data: unknown,
    options: DtoValidationOptions = {},
  ): Promise<T> {
    const result = await this.validateAndTransformSafe(dtoClass, data, options);

    if (!result.isValid && result.errors) {
      const errorPrefix = options.errorPrefix || 'Validation failed';
      const errorMessages = this.formatValidationErrors(result.errors);
      throw new Error(`${errorPrefix}: ${errorMessages}`);
    }

    return result.data;
  }

  /**
   * Valida e trasforma un oggetto usando un DTO class senza lanciare eccezioni
   *
   * @param dtoClass - La classe DTO da utilizzare per la validazione
   * @param data - I dati da validare
   * @param options - Opzioni per la validazione
   * @returns Il risultato della validazione con eventuali errori
   */
  async validateAndTransformSafe<T extends object>(
    dtoClass: ClassConstructor<T>,
    data: unknown,
    options: DtoValidationOptions = {},
  ): Promise<DtoValidationResult<T>> {
    let transformedData: T | unknown = data;

    // Applica la trasformazione se richiesta
    if (options.enableTransformation) {
      transformedData = plainToInstance(dtoClass, data);
    }

    // Applica la validazione se richiesta
    if (options.enableValidation) {
      const dtoInstance = plainToInstance(dtoClass, transformedData);
      const errors = await validate(dtoInstance, options.validatorOptions);

      if (errors.length > 0) {
        return {
          data: dtoInstance, // Usa sempre l'istanza DTO per consistency
          errors,
          isValid: false,
        };
      }

      transformedData = dtoInstance;
    }

    return {
      data: transformedData as T, // Type assertion sicuro dopo validazione/trasformazione
      isValid: true,
    };
  }

  /**
   * Formatta gli errori di validazione in una stringa leggibile
   *
   * @param errors - Array di errori di validazione
   * @returns Stringa formattata degli errori
   */
  private formatValidationErrors(errors: ValidationError[]): string {
    return errors
      .flatMap(error => Object.values(error.constraints || {}))
      .join(', ');
  }

  /**
   * Formatta gli errori di validazione in formato dettagliato
   *
   * @param errors - Array di errori di validazione
   * @returns Array di oggetti con dettagli degli errori
   */
  formatDetailedErrors(errors: ValidationError[]): Array<{
    property: string;
    value: unknown;
    constraints: string[];
  }> {
    return errors.map(error => ({
      property: error.property,
      value: error.value,
      constraints: Object.values(error.constraints || {}),
    }));
  }
}
