import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './src/server/app';

async function startServer() {
  const PORT = 3000;

  // Vite Middleware for development / static serving for production standalone server
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: process.env.DISABLE_HMR === 'true' ? null : {
          ignored: ['**/data/**', '**/uploads/**', '**/pos_database.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(expressStaticFallback(distPath));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Unique Sweets & Bakers POS Server running on http://0.0.0.0:${PORT}`);
  });
}

function expressStaticFallback(distPath: string) {
  const express = require('express');
  const router = express.Router();
  router.use(express.static(distPath));
  router.get('*', (req: any, res: any) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  return router;
}

startServer();
