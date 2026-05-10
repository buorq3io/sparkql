import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', "json"],
      reportsDirectory: './coverage',
      reportOnFailure: true,
      include: ["src/**/*.ts"],
      exclude: ["test/**/*.ts"],
    },
  },
});
