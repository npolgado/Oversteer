import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@render': path.resolve(__dirname, 'src/render'),
      '@gameplay': path.resolve(__dirname, 'src/gameplay'),
      '@scenes': path.resolve(__dirname, 'src/scenes'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@audio': path.resolve(__dirname, 'src/audio'),
      '@input': path.resolve(__dirname, 'src/input'),
      '@content': path.resolve(__dirname, 'src/content'),
      '@debug': path.resolve(__dirname, 'src/debug'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: [...configDefaults.exclude, 'test/**/*.test.js'],
    setupFiles: [],
    clearMocks: true,
    isolate: true,
    watch: false,
    coverage: {
      reporter: ['json'],
      include: [],
    },
  },
});
