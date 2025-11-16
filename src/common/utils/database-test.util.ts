/**
 * Utility per gestione database nei test di integrazione
 * Centralizza l'inizializzazione e configurazione del database per evitare duplicazione
 */

import * as dotenv from 'dotenv';
import {
  DataSource,
  DataSourceOptions,
  ObjectLiteral,
  Repository,
} from 'typeorm';

/**
 * Configurazione per i test di integrazione del database
 */
export interface DatabaseTestConfig {
  entities: any[];
  synchronize?: boolean;
  dropSchema?: boolean;
  logging?: boolean;
}

/**
 * Inizializza l'ambiente di test caricando le variabili d'ambiente
 * @param envPath Percorso del file .env (default: '.env.test')
 */
export function initializeTestEnvironment(envPath: string = '.env.test'): void {
  dotenv.config({ path: envPath });
}

/**
 * Crea una configurazione DataSource per i test di integrazione
 * @param config Configurazione specifica per i test
 * @returns Configurazione DataSource completa
 */
export function createTestDataSourceConfig(
  config: DatabaseTestConfig,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: config.entities,
    synchronize: config.synchronize ?? true, // Solo per test, non in produzione
    dropSchema: config.dropSchema ?? true, // DROP completo del schema prima della sincronizzazione
    logging: config.logging ?? false,
  } as unknown as DataSourceOptions;
}

/**
 * Inizializza una connessione al database per i test di integrazione
 * @param config Configurazione del database
 * @returns DataSource inizializzato
 */
export async function initializeTestDatabase(
  config: DatabaseTestConfig,
): Promise<DataSource> {
  const datasourceConfig = createTestDataSourceConfig(config);
  const dataSource = new DataSource(datasourceConfig);
  await dataSource.initialize();
  return dataSource;
}

/**
 * Pulisce lo stato del database e resetta le sequenze per un test isolato
 * @param repository Repository da pulire
 * @param dataSource DataSource per eseguire query raw
 * @param tableName Nome della tabella per resettare la sequenza
 * @param sequenceName Nome della sequenza (opzionale, default: `${tableName}_id_seq`)
 */
export async function cleanDatabaseState<T extends ObjectLiteral>(
  repository: Repository<T>,
  dataSource: DataSource,
  tableName: string,
  sequenceName?: string,
): Promise<void> {
  // Clean database state per ogni test
  await repository.clear();

  // Reset the ID sequence to start from 1
  const seqName = sequenceName || `${tableName}_id_seq`;
  await dataSource.query(`ALTER SEQUENCE ${seqName} RESTART WITH 1`);
}

/**
 * Chiude la connessione al database
 * @param dataSource DataSource da chiudere
 */
export async function closeTestDatabase(dataSource: DataSource): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

/**
 * Setup completo per test di integrazione di entità
 * Include inizializzazione ambiente, database e cleanup
 */
export class EntityIntegrationTestSetup<T extends ObjectLiteral> {
  private dataSource!: DataSource;
  private repository!: Repository<T>;
  private tableName: string;

  constructor(
    private entityClass: new () => T,
    private config: DatabaseTestConfig,
    tableName: string,
  ) {
    this.tableName = tableName;
  }

  /**
   * Inizializza il setup completo per i test
   */
  async initialize(): Promise<{
    dataSource: DataSource;
    repository: Repository<T>;
  }> {
    // Carica variabili d'ambiente
    initializeTestEnvironment();

    // Inizializza database
    this.dataSource = await initializeTestDatabase(this.config);
    this.repository = this.dataSource.getRepository(this.entityClass);

    return {
      dataSource: this.dataSource,
      repository: this.repository,
    };
  }

  /**
   * Pulisce lo stato per ogni test
   */
  async cleanState(): Promise<void> {
    await cleanDatabaseState(this.repository, this.dataSource, this.tableName);
  }

  /**
   * Cleanup finale
   */
  async cleanup(): Promise<void> {
    await closeTestDatabase(this.dataSource);
  }
}
