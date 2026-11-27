import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { closeDb, initDb } from './server/db.ts';
import { verifySameOriginMutation } from './server/auth.ts';
import { redactDatabaseUrl } from './server/pgHelpers.ts';
import { registerRoutes } from './server/routes.ts';

async function startServer() {
  await initDb();

  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('trust proxy', 1);

  const isProd = process.env.NODE_ENV === 'production';

  // Strict security headers & CSP
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const scriptSrc = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    const connectSrc = isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:";
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        connectSrc,
      ].join('; '),
    );
    next();
  });

  // Disable HTTP caching for dynamic API data (orders, products, settings)
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Origin check on mutating routes
  app.use('/api', verifySameOriginMutation);

  // JSON body parser for standard JSON routes (raw binary routes define their own express.raw)
  app.use((req, res, next) => {
    if (req.path === '/api/admin/video' || req.path === '/api/chargily/webhook') {
      next();
      return;
    }
    express.json({ limit: '8mb' })(req, res, next);
  });

  registerRoutes(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use('/api', (_req, res) => {
      res.status(404).json({ error: 'API route not found' });
    });
    app.use('/media', (_req, res) => {
      res.status(404).json({ error: 'Media not found' });
    });
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output missing');
      }
    });
  }

  // Global error handler — never leaks stack traces or DATABASE_URL credentials
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[server] unhandled route error:', redactDatabaseUrl(msg));
    res.status(500).json({ error: 'Internal server error' });
  });

  const envPort = Number(process.env.PORT || 0);
  const port = isProd ? envPort || 3000 : envPort && envPort !== 8080 ? envPort : 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Librairie Slimi server listening on http://0.0.0.0:${port}`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => {
      void closeDb().finally(() => process.exit(0));
    }, 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Failed to start server:', redactDatabaseUrl(msg));
  process.exit(1);
});
