import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auth + Lesson flow (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login — superadmin login returns accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'superadmin', password: 'Test1234!' })
      .expect(201);

    expect(res.body.data).toHaveProperty('accessToken');
    accessToken = res.body.data.accessToken;
  });

  it('GET /lessons — authenticated returns array', async () => {
    const res = await request(app.getHttpServer())
      .get('/lessons')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /auth/login — wrong password returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'superadmin', password: 'wrongpassword' })
      .expect(401);
  });

  it('GET /lessons — unauthenticated returns 401', async () => {
    await request(app.getHttpServer())
      .get('/lessons')
      .expect(401);
  });

  it('GET /gamification/xp — student can access own XP', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-tenant-slug', 'demo-markaz')
      .send({ login: 'jasur.student', password: 'Test1234!' })
      .expect(201);

    const studentToken = loginRes.body.data.accessToken;

    const xpRes = await request(app.getHttpServer())
      .get('/gamification/xp')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(xpRes.body.data).toHaveProperty('totalXp');
  });
});
