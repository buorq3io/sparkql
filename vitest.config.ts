import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration specs need running triple stores: `pnpm test:integration`.
    exclude: [...configDefaults.exclude, 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      include: ['src/**/*.ts'],
      exclude: ['test/**/*.ts'],
    },
  },
});
