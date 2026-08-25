import { test, expect } from 'vitest';
import request from 'supertest';
import { app } from './setup.ts';

test('search is a miss then a hit', async () => {
  await request(app).post('/auth/register').send({ email: 'search1@example.com', password: 'password' });
  const login = await request(app).post('/auth/login').send({ email: 'search1@example.com', password: 'password' });
  const cookies = login.headers['set-cookie'];

  await request(app)
    .post('/bookmarks')
    .set('Cookie', cookies!)
    .send({ url: 'https://example.com/cache-target', title: 'Cache Target' });

  let res = await request(app).get('/bookmarks/search').query({ q: 'Cache' });
  expect(res.status).toBe(200);
  expect(res.body.source).toBe('database');

  res = await request(app).get('/bookmarks/search').query({ q: 'Cache' });
  expect(res.status).toBe(200);
  expect(res.body.source).toBe('cache');
});
