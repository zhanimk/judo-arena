const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Tournament API', () => {
  let adminToken;

  beforeAll(async () => {
    const email = `admin${Date.now()}@example.com`;
    const password = '123456';
    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      fullName: 'Admin Test',
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.statusCode).toBe(200);
    adminToken = login.body.data.token;
  });

  test('create tournament', async () => {
    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Tournament ${Date.now()}`,
        description: 'Integration test tournament',
        location: 'Almaty',
        address: 'Arena',
        startDate: '2026-06-01T09:00:00.000Z',
        endDate: '2026-06-02T18:00:00.000Z',
        registrationDeadline: '2026-05-25T23:59:59.000Z',
        tatamiCount: 2,
        visibility: 'PUBLIC',
        categories: [
          {
            id: 'adult-m-81',
            label: 'Adult Men -81',
            gender: 'male',
            ageCategory: 'Adult',
            weightCategory: '-81',
            minAge: 18,
            maxAge: 35,
            minWeight: 73,
            maxWeight: 81,
            sortOrder: 1,
            categoryKey: 'male_adult_81',
          },
        ],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });
});