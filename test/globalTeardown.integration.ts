// Global teardown per test di integrazione
// Questo file viene eseguito UNA VOLTA dopo tutti i test di integrazione

export default async function globalTeardown() {
  console.log('🧹 Cleaning up integration test environment...');

  // TODO: Cleanup Testcontainers PostgreSQL se necessario
  // TODO: Cleanup test database

  console.log('✅ Integration test environment cleaned up');
}
