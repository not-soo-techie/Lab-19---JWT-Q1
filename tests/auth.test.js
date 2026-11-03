const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = require('../src/app');
const users = require('../src/data/users');
const { JWT_SECRET } = require('../src/config');

const validUser = { username: 'alice', password: 'password123' };

// Helpers
const register = (body = validUser) => request(app).post('/register').send(body);
const login = (body = validUser) => request(app).post('/login').send(body);

// Start every test with an empty "database"
beforeEach(() => {
  users.length = 0;
});

describe('POST /register', () => {
  test('1. registers a new user and returns 201 with id and username', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.message).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.username).toBe(validUser.username);
  });

  test('2. never sends the password back in the response', async () => {
    const res = await register();

    expect(res.body.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(validUser.password);
  });

  test('3. stores the user in the in-memory users array', async () => {
    await register();

    expect(users).toHaveLength(1);
    expect(users[0].username).toBe(validUser.username);
  });

  test('4. stores a bcrypt HASH of the password, not the plain text', async () => {
    await register();

    const stored = users[0].password;
    expect(stored).toBeDefined();
    expect(stored).not.toBe(validUser.password);
    expect(stored).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    expect(await bcrypt.compare(validUser.password, stored)).toBe(true);
  });

  test('5. gives every user a unique id', async () => {
    const r1 = await register({ username: 'alice', password: 'pass1' });
    const r2 = await register({ username: 'bob', password: 'pass2' });

    expect(r1.body.user.id).not.toBe(r2.body.user.id);
    expect(users).toHaveLength(2);
  });

  test('6. returns 400 when username is missing', async () => {
    const res = await register({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
    expect(users).toHaveLength(0);
  });

  test('7. returns 400 when password is missing', async () => {
    const res = await register({ username: 'alice' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
    expect(users).toHaveLength(0);
  });

  test('8. returns 409 when the username is already taken', async () => {
    await register();
    const res = await register({ username: 'alice', password: 'another' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBeDefined();
    expect(users).toHaveLength(1);
  });
});

describe('POST /login', () => {
  beforeEach(async () => {
    await register();
  });

  test('9. returns 200 and a token for correct credentials', async () => {
    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  test('10. token is a valid JWT signed with JWT_SECRET', async () => {
    const res = await login();
    const token = res.body.token;

    expect(token.split('.')).toHaveLength(3); // header.payload.signature
    expect(() => jwt.verify(token, JWT_SECRET)).not.toThrow();
  });

  test('11. token payload contains id and username but NOT the password', async () => {
    const res = await login();
    const payload = jwt.verify(res.body.token, JWT_SECRET);

    expect(payload.id).toBe(users[0].id);
    expect(payload.username).toBe(validUser.username);
    expect(payload.password).toBeUndefined();
  });

  test('12. token has an expiry time (exp claim)', async () => {
    const res = await login();
    const payload = jwt.verify(res.body.token, JWT_SECRET);

    expect(payload.exp).toBeDefined();
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  test('13. returns 401 for a wrong password', async () => {
    const res = await login({ username: 'alice', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('14. returns 401 for a username that does not exist', async () => {
    const res = await login({ username: 'ghost', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('15. uses the SAME error message for wrong password and unknown user', async () => {
    const wrongPass = await login({ username: 'alice', password: 'wrongpass' });
    const noUser = await login({ username: 'ghost', password: 'password123' });

    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.message).toBeDefined();
    expect(wrongPass.body.message).toBe(noUser.body.message);
  });

  test('16. returns 400 when username or password is missing', async () => {
    const noPass = await login({ username: 'alice' });
    const noUser = await login({ password: 'password123' });

    expect(noPass.status).toBe(400);
    expect(noUser.status).toBe(400);
  });
});

describe('GET /profile (protected route)', () => {
  let token;

  beforeEach(async () => {
    await register();
    const res = await login();
    token = res.body.token;
  });

  test('17. returns 200 and the user when a valid Bearer token is sent', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(users[0].id);
    expect(res.body.user.username).toBe(validUser.username);
    expect(res.body.user.password).toBeUndefined();
  });

  test('18. returns 401 when the Authorization header is missing', async () => {
    const res = await request(app).get('/profile');

    expect(res.status).toBe(401);
    expect(res.body.message).toBeDefined();
  });

  test('19. returns 401 when the header does not use the Bearer scheme', async () => {
    const noScheme = await request(app).get('/profile').set('Authorization', token);
    const wrongScheme = await request(app).get('/profile').set('Authorization', `Basic ${token}`);
    const emptyBearer = await request(app).get('/profile').set('Authorization', 'Bearer ');

    expect(noScheme.status).toBe(401);
    expect(wrongScheme.status).toBe(401);
    expect(emptyBearer.status).toBe(401);
  });

  test('20. returns 403 for a tampered token', async () => {
    const [header, , signature] = token.split('.');
    const fakePayload = Buffer.from(
      JSON.stringify({ id: 999, username: 'hacker' })
    ).toString('base64url');
    const tampered = `${header}.${fakePayload}.${signature}`;

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(403);
  });

  test('21. returns 403 for a token signed with a different secret', async () => {
    const forged = jwt.sign({ id: users[0].id, username: 'alice' }, 'not_the_real_secret');

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(403);
  });

  test('22. returns 403 for an expired token', async () => {
    const expired = jwt.sign(
      { id: users[0].id, username: 'alice', exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET
    );

    const res = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(403);
  });

  test('23. returns 403 for a random garbage string', async () => {
    const res = await request(app)
      .get('/profile')
      .set('Authorization', 'Bearer this.is.not-a-jwt');

    expect(res.status).toBe(403);
  });
});

describe('Full authentication flow', () => {
  test('24. register -> login -> access profile with token', async () => {
    const creds = { username: 'charlie', password: 'charlie@123' };

    const regRes = await register(creds);
    expect(regRes.status).toBe(201);

    const loginRes = await login(creds);
    expect(loginRes.status).toBe(200);
    const { token } = loginRes.body;

    const profileRes = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.username).toBe('charlie');
  });

  test('25. each user gets their own identity from their own token', async () => {
    await register({ username: 'dave', password: 'dave123' });
    await register({ username: 'erin', password: 'erin123' });

    const daveToken = (await login({ username: 'dave', password: 'dave123' })).body.token;
    const erinToken = (await login({ username: 'erin', password: 'erin123' })).body.token;

    const daveProfile = await request(app).get('/profile').set('Authorization', `Bearer ${daveToken}`);
    const erinProfile = await request(app).get('/profile').set('Authorization', `Bearer ${erinToken}`);

    expect(daveProfile.body.user.username).toBe('dave');
    expect(erinProfile.body.user.username).toBe('erin');
  });
});
