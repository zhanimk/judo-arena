const request = require('supertest');
const app = require('../src/app');

describe('Auth API', () => {
  test('register athlete', async () => {
    const email = `athlete${Date.now()}@example.com`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test Athlete',
        email,
        password: '123456',
        role: 'ATHLETE',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('login athlete', async () => {
    const email = `login${Date.now()}@example.com`;

    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Login Athlete',
        email,
        password: '123456',
        role: 'ATHLETE',
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email,
        password: '123456',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });
});