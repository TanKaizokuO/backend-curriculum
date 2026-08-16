import { test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.ts';

test('register and login with cookie', async () => {
  // Register
  let res = await request(app)
    .post('/auth/register')
    .send({ email: 'test@example.com', password: 'correct horse battery staple' });
  expect(res.status).toBe(201);
  expect(res.body.email).toBe('test@example.com');
  expect(res.body).toHaveProperty('id');

  // Login
  res = await request(app)
    .post('/auth/login')
    .send({ email: 'test@example.com', password: 'correct horse battery staple' });
  expect(res.status).toBe(200);

  const cookies = res.headers['set-cookie'];
  expect(cookies).toBeDefined();

  // Access protected route
  res = await request(app)
    .get('/auth/me')
    .set('Cookie', cookies!);
  expect(res.status).toBe(200);
  expect(res.body.email).toBe('test@example.com');
});

test('login with wrong password', async () => {
  await request(app)
    .post('/auth/register')
    .send({ email: 'test@example.com', password: 'correct horse battery staple' });

  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'test@example.com', password: 'wrong password' });
  expect(res.status).toBe(401);
  expect(res.body.detail).toBe('wrong email or password');
});

test('login with unknown email', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'nobody@example.com', password: 'correct horse battery staple' });
  expect(res.status).toBe(401);
  expect(res.body.detail).toBe('wrong email or password');
});
