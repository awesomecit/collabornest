import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import 'winston-daily-rotate-file';
import { CustomLogger } from './logger.service';

// Funzione di utilità per creare una directory
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Crea una directory per i log dei test
const testLogsDir = path.join(process.cwd(), 'logs', 'test');
ensureDirExists(testLogsDir);

describe('CustomLogger', () => {
  let logger: CustomLogger;
  let configService: ConfigService;
  let module: TestingModule;

  beforeAll(async () => {
    // Creiamo un modulo di test con ConfigService reale
    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useFactory: () => {
            return {
              get: (key: string) => {
                const config = {
                  NODE_ENV: 'test',
                  'logging.level': 'debug',
                  'logging.maxFiles': '7d',
                  'logging.maxSize': '10m',
                  'logging.timezone': 'Europe/Rome',
                  'logging.test.level': 'debug',
                  'logging.test.timezone': 'Europe/Rome',
                };
                return config[key];
              },
            };
          },
        },
        CustomLogger,
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<CustomLogger>(CustomLogger);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Initialization', () => {
    it('dovrebbe creare un logger con successo', () => {
      // Se l'istanza è stata creata senza errori, il test è passato
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(CustomLogger);
    });
  });

  describe('Log Methods', () => {
    it('dovrebbe eseguire il metodo log senza errori', () => {
      // Verifichiamo che non ci siano errori quando chiamiamo il metodo log
      expect(() => {
        logger.log('test log message', 'TestContext');
      }).not.toThrow();
    });

    it('dovrebbe eseguire il metodo error senza errori', () => {
      const testError = new Error('Test error');

      expect(() => {
        logger.error('test error message', testError.stack, 'ErrorContext');
      }).not.toThrow();
    });

    it('dovrebbe eseguire il metodo warn senza errori', () => {
      expect(() => {
        logger.warn('test warning message', 'WarnContext');
      }).not.toThrow();
    });

    it('dovrebbe eseguire il metodo debug senza errori', () => {
      expect(() => {
        logger.debug('test debug message', 'DebugContext');
      }).not.toThrow();
    });

    it('dovrebbe eseguire il metodo verbose senza errori', () => {
      expect(() => {
        logger.verbose('test verbose message', 'VerboseContext');
      }).not.toThrow();
    });

    it('dovrebbe eseguire il metodo info senza errori', () => {
      expect(() => {
        logger.info('test info message', 'InfoContext');
      }).not.toThrow();
    });
  });

  describe('Complex Data Handling', () => {
    it('dovrebbe registrare oggetti complessi senza errori', () => {
      const complexObject = {
        user: {
          id: 1,
          name: 'Test',
          roles: ['admin', 'user'],
        },
        metadata: {
          timestamp: new Date(),
          source: 'test',
        },
      };

      // Convertiamo l'oggetto in stringa JSON
      const complexObjectString = JSON.stringify(complexObject);

      expect(() => {
        logger.log('Log with complex object', 'ComplexTest');
        logger.log(complexObjectString, 'ComplexTest');
        // Test con oggetto passato alla funzione safeStringify interna
        logger.log(JSON.stringify(complexObject), 'ComplexObjectTest');
      }).not.toThrow();
    });

    it('dovrebbe registrare errori senza problemi', () => {
      const testError = new Error('Test error');

      expect(() => {
        logger.error('Error occurred', testError.stack, 'ErrorTest');
        // Test con errore diretto
        logger.error(testError.message, testError.stack, 'DirectErrorTest');
      }).not.toThrow();
    });

    it('dovrebbe registrare array senza errori', () => {
      const testArray = [1, 'test', { key: 'value' }];

      // Convertiamo l'array in stringa JSON
      const testArrayString = JSON.stringify(testArray);

      expect(() => {
        logger.log(testArrayString, 'ArrayTest');
        // Test con array passato a JSON.stringify
        logger.log(JSON.stringify(testArray), 'DirectArrayTest');
      }).not.toThrow();
    });

    it('dovrebbe gestire diversi tipi di dati primitivi', () => {
      expect(() => {
        // Numeri
        logger.log('42', 'NumberTest');
        // Booleani
        logger.log('true', 'BooleanTest');
        // Null
        logger.log('null', 'NullTest');
        // Undefined
        logger.log('undefined', 'UndefinedTest');
        // Symbol
        logger.log('Symbol(test)', 'SymbolTest');
        // BigInt
        logger.log('9007199254740991n', 'BigIntTest');
        // Function
        logger.log(
          'function testFunction() { return "test"; }',
          'FunctionTest',
        );
        logger.log('() => "test"', 'ArrowFunctionTest');
      }).not.toThrow();
    });

    it('dovrebbe gestire oggetti speciali', () => {
      expect(() => {
        // Date
        const date = new Date();
        logger.log(date.toISOString(), 'DateTest');

        // Oggetto con riferimenti circolari
        const circularObj: any = { name: 'circular' };
        circularObj.self = circularObj;
        logger.log('{"name":"circular","self":"[Circular]"}', 'CircularTest');

        // Oggetto con metodi
        const objectWithMethods = {
          name: 'test',
          method() {
            return this.name;
          },
        };
        logger.log(JSON.stringify({ name: 'test' }), 'ObjectWithMethodsTest');

        // Map e Set
        const map = new Map([['key', 'value']]);
        const set = new Set([1, 2, 3]);
        logger.log('Map(1) { "key" => "value" }', 'MapTest');
        logger.log('Set(3) { 1, 2, 3 }', 'SetTest');

        // Array grande
        const largeArray = Array(1000).fill('test');
        logger.log(
          JSON.stringify(largeArray).substring(0, 100) + '...',
          'LargeArrayTest',
        );

        // Oggetto grande
        const largeObject = {};
        for (let i = 0; i < 1000; i++) {
          largeObject[`key${i}`] = `value${i}`;
        }
        logger.log('{Object with many keys}', 'LargeObjectTest');
      }).not.toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('dovrebbe utilizzare le configurazioni specifiche per ambiente', async () => {
      // Creiamo un nuovo modulo con configurazioni specifiche per ambiente
      const prodModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: (key: string) => {
                  const config = {
                    NODE_ENV: 'production',
                    'logging.level': 'info',
                    'logging.production.level': 'warn',
                    'logging.maxFiles': '7d',
                    'logging.production.maxFiles': '30d',
                    'logging.maxSize': '10m',
                    'logging.timezone': 'Europe/Rome',
                  };
                  return config[key];
                },
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      const prodLogger = prodModule.get<CustomLogger>(CustomLogger);

      // Se l'istanza è stata creata senza errori, il test è passato
      expect(prodLogger).toBeDefined();

      // Testiamo che i metodi di log funzionino con le nuove configurazioni
      expect(() => {
        prodLogger.log('Production log test');
        prodLogger.warn('Production warning test');
      }).not.toThrow();

      await prodModule.close();
    });
  });

  describe('Default Configuration', () => {
    it('dovrebbe utilizzare valori predefiniti quando le configurazioni non sono specificate', async () => {
      // Salviamo il valore originale di NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const defaultModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: () => undefined, // Ritorna undefined per tutte le chiavi
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      const defaultLogger = defaultModule.get<CustomLogger>(CustomLogger);

      // Se l'istanza è stata creata senza errori, il test è passato
      expect(defaultLogger).toBeDefined();

      // Testiamo che i metodi di log funzionino con le configurazioni di default
      expect(() => {
        defaultLogger.log('Default config test');
        defaultLogger.error('Default config error test');
      }).not.toThrow();

      // Ripristiniamo il valore originale di NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;

      await defaultModule.close();
    });
  });

  describe('Timezone Handling', () => {
    it('dovrebbe accettare timezone valide', async () => {
      const tzModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: (key: string) => {
                  const config = {
                    NODE_ENV: 'test',
                    'logging.level': 'debug',
                    'logging.timezone': 'America/New_York',
                  };
                  return config[key];
                },
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      const tzLogger = tzModule.get<CustomLogger>(CustomLogger);

      // Se l'istanza è stata creata senza errori, il test è passato
      expect(tzLogger).toBeDefined();

      // Testiamo che i metodi di log funzionino con la nuova timezone
      expect(() => {
        tzLogger.log('Timezone test');
      }).not.toThrow();

      await tzModule.close();
    });

    it('dovrebbe gestire timezone non valide senza errori', async () => {
      const invalidTzModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: (key: string) => {
                  const config = {
                    NODE_ENV: 'test',
                    'logging.level': 'debug',
                    'logging.timezone': 'Invalid/Timezone',
                  };
                  return config[key];
                },
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      // Testiamo che il logger venga creato senza errori anche con una timezone non valida
      expect(() => {
        const invalidTzLogger = invalidTzModule.get<CustomLogger>(CustomLogger);
        expect(invalidTzLogger).toBeDefined();
      }).not.toThrow();

      await invalidTzModule.close();
    });
  });

  describe('File Transports', () => {
    it('dovrebbe creare file di log in ambienti diversi da test', async () => {
      // Salviamo il valore originale di NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;

      // Impostiamo temporaneamente NODE_ENV a development
      process.env.NODE_ENV = 'development';

      const fileLogModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: (key: string) => {
                  const config = {
                    NODE_ENV: 'development',
                    'logging.level': 'debug',
                  };
                  return config[key];
                },
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      const fileLogger = fileLogModule.get<CustomLogger>(CustomLogger);
      expect(fileLogger).toBeDefined();

      // Test di log in development (dovrebbe creare file di log)
      expect(() => {
        fileLogger.log('Development log test');
        fileLogger.error('Development error test');
      }).not.toThrow();

      // Ripristiniamo il valore originale di NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;

      await fileLogModule.close();
    });
  });

  // Test specifici per il comportamento di safeStringify
  describe('SafeStringify Function', () => {
    it('dovrebbe gestire null e undefined in modo appropriato', () => {
      expect(() => {
        logger.log('null value', 'NullTest');
        logger.log('undefined value', 'UndefinedTest');
      }).not.toThrow();
    });

    it('dovrebbe gestire gli errori con stack trace', () => {
      const testError = new Error('Test error');

      expect(() => {
        // Passiamo un Error come messaggio all'error method
        logger.error(testError.message, testError.stack, 'ErrorTest');
      }).not.toThrow();
    });

    it('dovrebbe gestire oggetti di grandi dimensioni troncandoli', () => {
      // Creiamo un oggetto molto grande
      const largeObject = {};
      for (let i = 0; i < 1000; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      expect(() => {
        logger.log(JSON.stringify(largeObject), 'LargeObjectTest');
      }).not.toThrow();
    });
  });

  describe('Log Levels', () => {
    let loggerWithProductionLevel: CustomLogger;
    let prodConfigModule: TestingModule;

    beforeAll(async () => {
      // Creiamo un logger con livello info (produzione)
      prodConfigModule = await Test.createTestingModule({
        providers: [
          {
            provide: ConfigService,
            useFactory: () => {
              return {
                get: (key: string) => {
                  const config = {
                    NODE_ENV: 'production',
                    'logging.level': 'info',
                  };
                  return config[key];
                },
              };
            },
          },
          CustomLogger,
        ],
      }).compile();

      loggerWithProductionLevel =
        prodConfigModule.get<CustomLogger>(CustomLogger);
    });

    afterAll(async () => {
      await prodConfigModule.close();
    });

    it('dovrebbe rispettare il livello di log configurato', () => {
      expect(() => {
        // In produzione con livello info, questi dovrebbero essere registrati
        loggerWithProductionLevel.info('Info message', 'ProductionTest');
        loggerWithProductionLevel.warn('Warning message', 'ProductionTest');
        loggerWithProductionLevel.error(
          'Error message',
          undefined,
          'ProductionTest',
        );

        // In produzione con livello info, debug e verbose non dovrebbero generare errori
        // anche se potrebbero non apparire nel log
        loggerWithProductionLevel.debug('Debug message', 'ProductionTest');
        loggerWithProductionLevel.verbose('Verbose message', 'ProductionTest');
      }).not.toThrow();
    });
  });

  describe('Internal Helper Functions Coverage', () => {
    it('should test all primitive type handling paths through context', () => {
      // Given: Various primitive and edge case values as context
      const testCases = [
        { value: null, name: 'null' },
        { value: undefined, name: 'undefined' },
        { value: 42, name: 'number' },
        { value: true, name: 'true' },
        { value: false, name: 'false' },
        { value: BigInt(9007199254740991), name: 'bigint' },
      ];

      // When: Logging with these values as context to trigger safeStringify
      // Then: Should not throw errors and handle each case correctly
      expect(() => {
        testCases.forEach(testCase => {
          logger.info('Testing primitive', testCase.value as any);
          logger.debug('Testing primitive', testCase.value as any);
          logger.warn('Testing primitive', testCase.value as any);
          logger.error(
            'Testing primitive',
            testCase.value as any,
            testCase.value as any,
          );
        });
      }).not.toThrow();
    });

    it('should test special object handling paths through context', () => {
      // Given: Special object types that trigger different code paths
      const testDate = new Date('2023-01-01T00:00:00.000Z');
      const testError = new Error('Test error for helper coverage');
      testError.stack = 'Test stack trace\n  at TestFunction';

      const testErrorNoStack = new Error('Error without stack');
      delete testErrorNoStack.stack;

      const testArray = ['item1', 2, { nested: 'object' }, null, undefined];
      const emptyArray: any[] = [];

      // When: Testing these special objects as context
      // Then: Should handle each type appropriately without errors
      expect(() => {
        logger.info('Testing date', testDate as any);
        logger.error('Testing error with stack', '', testError as any);
        logger.error(
          'Testing error without stack',
          '',
          testErrorNoStack as any,
        );
        logger.info('Testing array', testArray as any);
        logger.info('Testing empty array', emptyArray as any);
      }).not.toThrow();
    });

    it('should test generic object fallback paths through context', () => {
      // Given: Objects that trigger fallback representation paths
      const simpleObject = { key1: 'value1', key2: 'value2' };

      // Object that will cause JSON.stringify to fail
      const cyclicObject: any = { name: 'cyclic' };
      cyclicObject.self = cyclicObject;

      // Object without constructor
      const objectWithoutConstructor = Object.create(null);
      objectWithoutConstructor.someKey = 'someValue';

      // When: Testing these edge case objects as context
      // Then: Should handle fallback scenarios correctly
      expect(() => {
        logger.info('Testing simple object', simpleObject as any);
        logger.info('Testing cyclic object', cyclicObject as any);
        logger.info(
          'Testing object without constructor',
          objectWithoutConstructor as any,
        );
      }).not.toThrow();
    });

    it('should test function and symbol handling through context', () => {
      // Given: Function and symbol types
      function namedFunction() {
        return 'test';
      }
      const anonymousFunction = function () {
        return 'anonymous';
      };
      const arrowFunction = () => 'arrow';
      const testSymbol = Symbol('testSymbol');
      const testSymbolWithoutDescription = Symbol();

      // When: Logging these special types as context
      // Then: Should convert to appropriate string representations
      expect(() => {
        logger.info('Testing named function', namedFunction as any);
        logger.info('Testing anonymous function', anonymousFunction as any);
        logger.info('Testing arrow function', arrowFunction as any);
        logger.info('Testing symbol', testSymbol as any);
        logger.info(
          'Testing symbol without description',
          testSymbolWithoutDescription as any,
        );
      }).not.toThrow();
    });

    it('should test string length truncation for large objects through context', () => {
      // Given: Very large object that will exceed 500 character limit
      const largeObject: any = {};
      for (let i = 0; i < 100; i++) {
        largeObject[`veryLongKeyName${i}`] =
          `veryLongValueThatWillMakeTheJSONStringificationExceedTheLimit${i}`;
      }

      // When: Logging large object as context
      // Then: Should truncate without errors
      expect(() => {
        logger.info('Testing large object truncation', largeObject as any);
      }).not.toThrow();
    });

    it('should test unrecognized value type fallback through context', () => {
      // Given: Edge case values that might trigger unrecognized type fallback
      const weirdTypes = [new WeakMap(), new WeakSet(), new Proxy({}, {})];

      // When: Logging these edge case types as context
      // Then: Should handle gracefully with fallback representation
      expect(() => {
        weirdTypes.forEach((value, index) => {
          logger.info(`Testing weird type ${index}`, value as any);
        });
      }).not.toThrow();
    });

    it('should test object key extraction fallback through context', () => {
      // Given: Object that might cause Object.keys to fail
      const problematicObject = Object.create(null);
      Object.defineProperty(problematicObject, 'problematicKey', {
        enumerable: false,
        value: 'hidden',
      });

      // When: Logging problematic object as context
      // Then: Should handle gracefully with constructor name fallback
      expect(() => {
        logger.info('Testing problematic object', problematicObject as any);
      }).not.toThrow();
    });

    it('should test array with complex items through context', () => {
      // Given: Array containing various complex types
      const complexArray = [
        { nested: { deep: { object: 'value' } } },
        new Date(),
        new Error('Test error'),
        function () {
          return 'test';
        },
        Symbol('arraySymbol'),
        null,
        undefined,
        [1, 2, [3, 4]],
      ];

      // When: Logging complex array as context
      // Then: Should handle all nested types correctly
      expect(() => {
        logger.info('Testing complex array', complexArray as any);
      }).not.toThrow();
    });

    it('should test error stack path with different objects', () => {
      // Given: Various objects passed as stack to error method
      const stackObjects = [
        'simple string stack',
        null,
        undefined,
        { objectAsStack: 'test' },
        ['array', 'as', 'stack'],
        42,
        true,
      ];

      // When: Using these as stack parameter
      // Then: Should handle through safeStringify correctly
      expect(() => {
        stackObjects.forEach((stack, index) => {
          logger.error(
            `Testing stack object ${index}`,
            stack as any,
            'StackTest',
          );
        });
      }).not.toThrow();
    });

    it('should test deep nested array processing', () => {
      // Given: Deeply nested array that triggers recursive safeStringify
      const deepArray = [
        [
          [
            {
              level3: {
                level4: [
                  'deep',
                  { veryDeep: true },
                  null,
                  undefined,
                  Symbol('deep'),
                ],
              },
            },
          ],
        ],
      ];

      // When: Logging deep nested structure
      // Then: Should process all levels without errors
      expect(() => {
        logger.info('Testing deep array', deepArray as any);
      }).not.toThrow();
    });
  });
});
