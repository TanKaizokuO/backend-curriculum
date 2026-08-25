import { test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server.ts';

test('create and delete own bookmark', async () => {
  await request(app).post('/auth/register').send({ email: 'user1@example.com', password: 'password' });
  let loginRes = await request(app).post('/auth/login').send({ email: 'user1@example.com', password: 'password' });
  const cookies = loginRes.headers['set-cookie'];

  let res = await request(app)
    .post('/bookmarks')
    .set('Cookie', cookies!)
    .send({ url: 'https://example.com/1' });
  expect(res.status).toBe(201);
  const bookmarkId = res.body.id;

  res = await request(app)
    .delete(`/bookmarks/${bookmarkId}`)
    .set('Cookie', cookies!);
});

test('create bookmark requires auth', async () => {
  const res = await request(app).post('/bookmarks').send({ url: 'https://example.com/1' });
  expect(res.status).toBe(401);
});

test('cannot delete others bookmark', async () => {
  await request(app).post('/auth/register').send({ email: 'usera@example.com', password: 'password' });
  let resA = await request(app).post('/auth/token').send({ email: 'usera@example.com', password: 'password' });
  const tokenA = resA.body.access_token;

  let res = await request(app)
    .post('/bookmarks')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ url: 'https://example.com/a' });
  const bookmarkId = res.body.id;

  await request(app).post('/auth/register').send({ email: 'userb@example.com', password: 'password' });
  let resB = await request(app).post('/auth/token').send({ email: 'userb@example.com', password: 'password' });
  const tokenB = resB.body.access_token;

  res = await request(app)
    .delete(`/bookmarks/${bookmarkId}`)
    .set('Authorization', `Bearer ${tokenB}`);
  expect(res.status).toBe(403);
  expect(res.body.detail).toBe('not your bookmark');
});
