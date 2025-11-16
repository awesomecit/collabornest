// Setup files per test di integrazione con controlli sicurezza
import { config } from 'dotenv';

// Carica variabili d'ambiente per i test
config({ path: '.env.test' });

// Setup Jest environment per test di integrazione
beforeAll(async () => {
  // SAFETY CHECK: Garantisce esecuzione solo in ambiente test
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      `❌ SAFETY CHECK FAILED! Tests must run with NODE_ENV=test, got: ${process.env.NODE_ENV}`,
    );
  }

  // SAFETY CHECK: Verifica database non sia production
  const dbName = process.env.DATABASE_NAME;
  if (dbName && (dbName.includes('prod') || dbName.includes('production'))) {
    throw new Error(
      `❌ DANGER! Attempting to run tests against production database: ${dbName}`,
    );
  }

  // Forza NODE_ENV test (doppia sicurezza)
  process.env.NODE_ENV = 'test';

  console.log('✅ Integration test environment safety checks passed');
});

afterAll(async () => {
  // Cleanup globale
});
