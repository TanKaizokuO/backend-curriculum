import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://testuser:testpassword@127.0.0.1:5432/testdb',
      BCRYPT_ROUNDS: '4',
      SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef',
    },
  },
});
