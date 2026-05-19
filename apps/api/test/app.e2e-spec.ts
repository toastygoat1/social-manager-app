import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller.js';
import { AppService } from '../src/app.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    return request(httpServer)
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'post_1',
          content: 'First scheduled post',
          status: 'draft',
          scheduledAt: null,
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
