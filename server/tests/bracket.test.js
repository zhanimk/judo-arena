const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Bracket API', () => {
  let adminToken;
  let coachToken;
  let athleteId;
  let clubId;
  let tournamentId;
  let applicationId;

  beforeAll(async () => {
    const adminEmail = `admin${Date.now()}@example.com`;
    const coachEmail = `coach${Date.now()}@example.com`;
    const athleteEmail = `athlete${Date.now()}@example.com`;
    const adminPassword = '123456';

    await User.create({
      fullName: 'Admin Bracket',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      status: 'ACTIVE',
      isActive: true,
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminToken = adminLogin.body.data.token;

    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Coach Bracket',
        email: coachEmail,
        password: '123456',
        role: 'COACH',
      });

    const athleteRegister = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Athlete Bracket',
        email: athleteEmail,
        password: '123456',
        role: 'ATHLETE',
      });

    athleteId = athleteRegister.body.data.user._id;

    const coachLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: coachEmail, password: '123456' });

    const athleteLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: athleteEmail, password: '123456' });

    coachToken = coachLogin.body.data.token;
    const athleteToken = athleteLogin.body.data.token;

    await User.findByIdAndUpdate(athleteId, {
      gender: 'male',
      dateOfBirth: new Date('2000-01-01'),
      city: 'Almaty',
      weight: 80,
      rank: '1 kyu',
      status: 'ACTIVE',
      isActive: true,
    });

    const clubRes = await request(app)
      .post('/api/clubs')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `Bracket Club ${Date.now()}`,
        city: 'Almaty',
        description: 'Bracket test club',
      });

    clubId = clubRes.body.data._id;

    await request(app)
      .post(`/api/clubs/${clubId}/join-request`)
      .set('Authorization', `Bearer ${athleteToken}`);

    await request(app)
      .patch(`/api/clubs/${clubId}/members/${athleteId}/approve`)
      .set('Authorization', `Bearer ${coachToken}`);

    const tournamentRes = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `Bracket Tournament ${Date.now()}`,
        description: 'Bracket integration test',
        location: 'Almaty',
        address: 'Arena',
        startDate: '2026-06-01T09:00:00.000Z',
        endDate: '2026-06-02T18:00:00.000Z',
        registrationDeadline: '2026-05-25T23:59:59.000Z',
        tatamiCount: 2,
        visibility: 'PUBLIC',
        status: 'REGISTRATION_OPEN',
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

    tournamentId = tournamentRes.body.data._id;

    const applicationRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        tournamentId,
        clubId,
        athletes: [athleteId],
        documents: [],
      });

    applicationId = applicationRes.body.data._id;

    await request(app)
      .patch(`/api/applications/${applicationId}/submit`)
      .set('Authorization', `Bearer ${coachToken}`);

    await request(app)
      .patch(`/api/applications/${applicationId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .patch(`/api/tournaments/${tournamentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REGISTRATION_CLOSED',
        });
    });
  
    test('generate brackets and fetch matches', async () => {
      const generateRes = await request(app)
        .post(`/api/brackets/generate/${tournamentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
  
      expect(generateRes.statusCode).toBe(201);
      expect(generateRes.body.success).toBe(true);
  
      const bracketId = generateRes.body.data[0]._id;
  
      const bracketRes = await request(app)
        .get(`/api/brackets/${bracketId}`)
        .set('Authorization', `Bearer ${adminToken}`);
  
      expect(bracketRes.statusCode).toBe(200);
  
      const matchesRes = await request(app)
        .get(`/api/brackets/${bracketId}/matches`)
        .set('Authorization', `Bearer ${adminToken}`);
  
      expect(matchesRes.statusCode).toBe(200);
      expect(Array.isArray(matchesRes.body.data)).toBe(true);
    });
  });