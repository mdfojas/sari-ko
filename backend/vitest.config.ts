import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // All test files share one local Postgres database (see reset-db.ts).
    // Running files in parallel lets one file's TRUNCATE race another
    // file's mid-test inserts, so they must run sequentially.
    fileParallelism: false,
  },
});
