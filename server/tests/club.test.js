const request = require('supertest');
const app = require('../src/app');

let coachToken;

describe('Club API', () => {
  beforeAll(async () => {
    const email = `coach${Date.now()}@example.com`;

    const register = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Coach Test',
        email,
        password: '123456',
        role: 'COACH',
      });

    expect(register.statusCode).toBe(201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: '123456',
      });

    expect(login.statusCode).toBe(200);
    coachToken = login.body.data.token;
  });

  test('create club', async () => {
    const res = await request(app)
      .post('/api/clubs')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `Test Club ${Date.now()}`,
        city: 'Almaty',
        description: 'Judo club',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });
});