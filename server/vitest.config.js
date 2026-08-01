import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Real-listener suites share process-wide environment and mocks; file
    // parallelism makes their beforeEach/afterEach boundaries race.
    fileParallelism: false,
    include: ['src/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', 'library', 'download'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.config.{js,ts}',
        'library/**',
        'download/**',
      ],
    },
    testTimeout: 10000,
  },
});
