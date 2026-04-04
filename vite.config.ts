import { defineConfig } from 'vite';
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
    },
  },
  publicDir: 'public',
  server: {
    open: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
