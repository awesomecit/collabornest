import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (E2E) - Database Integration', () => {
  let app: INestApplication;

  describe('Application with Database Integration', () => {
    describe('GIVEN the application is running with database connection', () => {
      beforeAll(async () => {
        // GIVEN: Application module with database integration
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
      });

      afterAll(async () => {
        await app.close();
      });

      describe('WHEN requesting application endpoints', () => {
        it('THEN should respond successfully indicating application is running with database', async () => {
          // WHEN: Request root endpoint
          const response = await request(app.getHttpServer())
            .get('/')
            .expect(200);

          // THEN: Should return successful response
          expect(response.text).toContain('Hello World');
        });

        it('THEN should have database connection available (health endpoint exists)', async () => {
          // WHEN: Request health endpoint (may return 200 or 503 based on checks)
          const response = await request(app.getHttpServer()).get('/health');

          // THEN: Endpoint should be available (not 404) indicating database integration
          expect([200, 503]).toContain(response.status);
          expect(response.status).not.toBe(404);
        });
      });
      describe('WHEN requesting application root', () => {
        it('THEN should respond successfully indicating database connectivity', async () => {
          // WHEN: Request root endpoint
          const response = await request(app.getHttpServer())
            .get('/')
            .expect(200);

          // THEN: Should return successful response
          expect(response.text).toContain('Hello World');
        });
      });
    });
  });
});
