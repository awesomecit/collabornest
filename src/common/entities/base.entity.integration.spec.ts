// ================================
// BASE ENTITY TDD TEST STRUCTURE
// npm test -- src/common/entities/base.entity.integration.spec.ts
// ================================

import { DataSource, Repository } from 'typeorm';
import {
  EntityIntegrationTestSetup,
  cleanDatabaseState,
} from '../utils/database-test.util';
import { BaseEntity } from './base.entity';

// Test entity concreta per testare BaseEntity
import { randomUUID } from 'crypto';
import { Column, Entity } from 'typeorm';

@Entity('test_base_entity')
class TestEntity extends BaseEntity {
  // Campo test per forzare aggiornamenti nei test
  @Column({ nullable: true })
  testField?: string;
}

/**
 * Strategia TDD per BaseEntity: Integration Behavior Testing
 *
 * Focus sui comportamenti comuni a tutte le entità:
 * - Auto-generazione di id, uuid, timestamps
 * - Comportamento di createdAt/updatedAt
 * - Comportamento del flag active
 * - Comportamento del versioning
 * - Soft delete functionality
 *
 * NON testiamo:
 * - Sintassi TypeORM base (già testata dal framework)
 * - Funzionalità TypeORM standard
 */

describe('BaseEntity - TDD Integration Tests', () => {
  let dataSource: DataSource;
  let testEntityRepository: Repository<TestEntity>;
  let testSetup: EntityIntegrationTestSetup<TestEntity>;

  beforeAll(async () => {
    // Setup centralizzato per test di integrazione
    testSetup = new EntityIntegrationTestSetup(
      TestEntity,
      {
        entities: [TestEntity],
        synchronize: true,
        dropSchema: true,
        logging: false,
      },
      'test_base_entity',
    );

    const setup = await testSetup.initialize();
    dataSource = setup.dataSource;
    testEntityRepository = setup.repository;
  });

  beforeEach(async () => {
    // Pulisce lo stato del database usando utility centralizzata
    await cleanDatabaseState(
      testEntityRepository,
      dataSource,
      'test_base_entity',
    );
  });

  afterAll(async () => {
    // Cleanup centralizzato
    await testSetup.cleanup();
  });

  // ================================
  // TEST SERIE 1: BASIC ENTITY CREATION
  // Obiettivo: Verificare che BaseEntity generi automaticamente i campi base
  // ================================

  describe('Basic BaseEntity Creation', () => {
    /**
     * TEST 1: Verifica creazione entità base
     * Testa che BaseEntity generi automaticamente id, createdAt, updatedAt, version
     */
    it('should create and persist entity with auto-generated base fields', async () => {
      // Arrange: Dati minimi per creazione entità
      const entity = new TestEntity();
      entity.uuid = randomUUID();

      // Act: Creazione e salvataggio entità
      const savedEntity = await testEntityRepository.save(entity);

      // Assert: Entità salvata con campi base auto-generati
      expect(savedEntity).toBeDefined();
      expect(savedEntity.uuid).toBeDefined();
      expect(savedEntity.id).toBe(1);
      expect(savedEntity.createdAt).toBeInstanceOf(Date);
      expect(savedEntity.updatedAt).toBeInstanceOf(Date);
      expect(savedEntity.deletedAt).toBeNull();
      expect(savedEntity.version).toBe(1); // Versione iniziale
    });
  });

  // ================================
  // TEST SERIE 2: TIMESTAMP BEHAVIOR
  // Obiettivo: Verificare comportamento di createdAt/updatedAt
  // ================================

  describe('Timestamp Behavior', () => {
    /**
     * TEST 4: Verifica aggiornamento di updatedAt
     * Testa che updatedAt venga aggiornato quando l'entità viene modificata
     */
    it('should update updatedAt timestamp when entity is modified', async () => {
      // Arrange: Entità salvata esistente
      const entity = new TestEntity();
      entity.uuid = randomUUID();

      const savedEntity = await testEntityRepository.save(entity);
      const originalCreatedAt = savedEntity.createdAt;
      const originalUpdatedAt = savedEntity.updatedAt;
      const originalVersion = savedEntity.version;

      // Simula attesa per garantire differenza di timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Act: Modifica entità con un cambiamento effettivo
      savedEntity.testField = 'modified value';
      const updatedEntity = await testEntityRepository.save(savedEntity);

      // Assert: updatedAt è cambiato, createdAt rimane uguale, version incrementata
      expect(updatedEntity.updatedAt).toBeInstanceOf(Date);
      expect(updatedEntity.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
      expect(updatedEntity.createdAt.getTime()).toBe(
        originalCreatedAt.getTime(),
      );
      expect(updatedEntity.version).toBe(originalVersion + 1);
    });

    /**
     * TEST 5: Verifica che createdAt non cambi dopo aggiornamento
     * Testa che il campo createdAt rimanga invariato dopo aggiornamenti
     */
    it('should not change createdAt after updates', async () => {
      // Arrange: Entità salvata esistente
      const entity = new TestEntity();
      entity.uuid = randomUUID();

      const savedEntity = await testEntityRepository.save(entity);
      const originalCreatedAt = savedEntity.createdAt;

      // Act: Multipli aggiornamenti
      await testEntityRepository.save(savedEntity);

      const finalEntity = await testEntityRepository.save(savedEntity);

      // Assert: createdAt rimane sempre uguale
      expect(finalEntity.createdAt.getTime()).toBe(originalCreatedAt.getTime());
      expect(finalEntity.version).toBe(1); // Versione incrementata
    });
  });

  // ================================
  // TEST SERIE 3: VERSION BEHAVIOR
  // Obiettivo: Verificare comportamento del versioning
  // ================================

  describe('Version Behavior', () => {
    /**
     * TEST 6: Verifica incremento della versione
     * Testa che la versione si incrementi ad ogni aggiornamento
     */
    it('should increment version on each update', async () => {
      // Arrange: Entità salvata esistente
      const entity = new TestEntity();
      entity.uuid = randomUUID();
      entity.testField = 'initial value';

      const savedEntity = await testEntityRepository.save(entity);
      expect(savedEntity.version).toBe(1);

      // Act: Prima modifica
      savedEntity.testField = 'modified value';
      const firstUpdate = await testEntityRepository.save(savedEntity);
      expect(firstUpdate.version).toBe(2);

      // Act: Seconda modifica
      firstUpdate.testField = 'second modification';
      const secondUpdate = await testEntityRepository.save(firstUpdate);

      // Assert: Versione incrementata correttamente
      expect(secondUpdate.version).toBe(3);
    });
  });
});
