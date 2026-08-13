console.log('[VERCEL] api/index.ts loading');
console.log('[VERCEL] importing Express app bundle from dist/app.cjs');
// @ts-ignore
import appModule from '../dist/app.cjs';

const app = appModule.default || appModule.app || appModule;
console.log('[VERCEL] Express app loaded successfully, type:', typeof app);

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[VERCEL Serverless Handler Exception]:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error in Serverless Handler',
        message: err?.message || 'Server invocation failed',
      });
    }
  }
}

