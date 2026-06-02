import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';

// Vite dev-only plugin: exposes POST /api/log and POST /api/log/flush.
// The browser logger batches entries and sends them here; we append to logs/game.log
// so the file can be read directly from the project root without browser access.
const MAX_LOG_BYTES = 5 * 1024 * 1024; // rotate when game.log exceeds 5 MB

function gameLoggerPlugin(): Plugin {
  const logDir  = path.resolve(__dirname, 'logs');
  const logFile = path.join(logDir, 'game.log');

  return {
    name: 'game-logger',
    configureServer(server) {
      fs.mkdirSync(logDir, { recursive: true });
      // Rotate if the log is too large, then append a session header.
      // This preserves startup lines across dev-server restarts — previously the
      // log was truncated on every restart which erased boot errors.
      try {
        const st = fs.statSync(logFile);
        if (st.size > MAX_LOG_BYTES) {
          const rotated = path.join(logDir, `game-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
          fs.renameSync(logFile, rotated);
        }
      } catch (_) { /* file may not exist yet */ }
      fs.appendFileSync(logFile, `\n=== session ${new Date().toISOString()} ===\n`);

      server.middlewares.use('/api/log', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { lines } = JSON.parse(body) as { lines: string[] };
            if (Array.isArray(lines) && lines.length > 0) {
              fs.appendFileSync(logFile, lines.join('\n') + '\n');
            }
          } catch (_) { /* ignore malformed */ }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [gameLoggerPlugin()],
  base: '/Oversteer/',
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
      '@dev': path.resolve(__dirname, 'src/dev'),
    },
  },
  build: {
    target: 'esnext',
  },
  publicDir: 'public',
  server: {
    open: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    benchmark: {
      include: ['src/**/*.bench.ts'],
    },
  },
});
