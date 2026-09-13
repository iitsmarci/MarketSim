import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['benchmarks/**/*.profile.ts'],
    maxWorkers: 1,
    pool: 'threads',
    testTimeout: 900_000,
  },
});
