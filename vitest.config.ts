import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        'example.ts',
        'src/types/',
      ],
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts', 'tests/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
  },
});
