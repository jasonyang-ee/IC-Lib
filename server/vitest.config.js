import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', 'downloads', 'download'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.config.{js,ts}',
        'downloads/**',
        'download/**',
      ],
    },
    testTimeout: 10000,
  },
});
