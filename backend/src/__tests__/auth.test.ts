import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  registerUser,
  authenticateUser,
  userCount,
} from '../data/userStore';

describe('Auth — password validation (mock store)', () => {
  it('rejects login with wrong password (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: DEMO_EMAIL, password: 'DefinitelyWrong!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects login for unregistered email (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: DEMO_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('accepts login with correct demo credentials (200 + token)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(DEMO_EMAIL);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('requires email and password fields (400)', async () => {
    const missing = await request(app).post('/api/auth/login').send({ email: DEMO_EMAIL });
    expect(missing.status).toBe(400);

    const empty = await request(app).post('/api/auth/login').send({});
    expect(empty.status).toBe(400);
  });

  it('signup requires password (400)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test User', email: 'new-user@toroloom.com', phone: '+91 99999 00000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeDefined();
  });

  it('signup creates a login-able account, duplicate email is 409', async () => {
    const email = `dup-${Date.now()}@toroloom.com`;

    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Dup User', email, phone: '+91 99999 11111', password: 'Strong@123' });
    expect(signup.status).toBe(200);
    expect(signup.body.token).toBeTruthy();

    // Login with the new credentials
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Strong@123' });
    expect(login.status).toBe(200);

    // Wrong password for the new user
    const badLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Wrong@123' });
    expect(badLogin.status).toBe(401);

    // Duplicate signup rejected
    const dup = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Dup User 2', email, phone: '+91 99999 22222', password: 'Strong@456' });
    expect(dup.status).toBe(409);
  });

  it('store: authenticateUser hashes passwords (no plaintext, timing-safe verify)', () => {
    const email = `store-${Date.now()}@toroloom.com`;
    registerUser({ name: 'Store User', email, phone: '+91 99999 33333', password: 'Secret@99' });

    expect(authenticateUser(email, 'Secret@99')).not.toBeNull();
    expect(authenticateUser(email, 'Nope@99')).toBeNull();
    expect(authenticateUser(email, 'Secret@99')?.passwordHash).not.toContain('Secret@99');

    // Demo seed exists
    expect(authenticateUser(DEMO_EMAIL, DEMO_PASSWORD)).not.toBeNull();
    expect(userCount()).toBeGreaterThanOrEqual(1);
  });
});
