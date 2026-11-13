import { defineConfig } from 'vitest/config';

/**
 * Runs test/integration against real triple stores; see test/integration/README.md.
 * Start them first with `pnpm db:up`.
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts'],
    globalSetup: ['test/integration/setup.ts'],
    // Specs share each engine's store, and some write to it: run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
