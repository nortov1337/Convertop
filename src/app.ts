import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { apiRouter } from './routes/api.js';
import { ConversionError } from './errors.js';
import { langFrom, errorMessage } from './locales.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use(express.static(path.resolve(__dirname, '../public')));
  app.use('/api', apiRouter);

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const lang = langFrom(req.headers['accept-language']);
    if (err instanceof multer.MulterError) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'fileTooLarge' : 'uploadFailed';
      return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: errorMessage(code, lang), code });
    }
    if (err instanceof ConversionError) {
      return res.status(err.status).json({ error: errorMessage(err.code, lang, err.params), code: err.code });
    }
    console.error(err);
    res.status(500).json({ error: errorMessage('internal', lang), code: 'internal' });
    next();
  });

  return app;
}
