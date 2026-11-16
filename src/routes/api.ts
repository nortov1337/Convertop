import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import { uploadDir } from '../storage.js';
import { config } from '../config.js';
import { extOf, canonicalExt } from '../util.js';
import { targetsFor, categoryOf, labelOf, mimeOf, CATEGORIES } from '../formats.js';
import { langFrom, categoryLabels, actionLabel, errorMessage } from '../locales.js';
import { detectCapabilities } from '../capabilities.js';
import { dispatch } from '../engines/dispatch.js';
import { ConversionError } from '../errors.js';
import type { ConvertRequest, ConvertOptions } from '../types.js';

export const apiRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 20 },
});

function cleanup(paths: Array<string | undefined>): void {
  for (const p of paths) {
    if (!p) continue;
    fsp.rm(p, { force: true }).catch(() => {});
  }
}

function parseOptions(body: Record<string, unknown>): ConvertOptions {
  const quality = body.quality != null ? Number(body.quality) : undefined;
  return {
    quality: quality != null && Number.isFinite(quality) ? Math.min(100, Math.max(1, Math.round(quality))) : undefined,
    password: typeof body.password === 'string' ? body.password : undefined,
  };
}

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, capabilities: detectCapabilities() });
});

apiRouter.get('/formats', (req, res) => {
  const lang = langFrom(req.headers['accept-language']);
  const labels = categoryLabels(lang);
  res.json({
    capabilities: detectCapabilities(),
    categories: CATEGORIES.map((id) => ({ id, label: labels[id] })),
  });
});

apiRouter.get('/targets', (req, res) => {
  const lang = langFrom(req.headers['accept-language']);
  const from = canonicalExt(String(req.query.from ?? ''));
  if (!from) return res.status(400).json({ error: errorMessage('badFrom', lang), code: 'badFrom' });
  const { targets, action } = targetsFor(from);
  res.json({
    from,
    category: categoryOf(from),
    targets: targets.map((ext) => ({ ext, label: labelOf(ext), category: categoryOf(ext), mime: mimeOf(ext) })),
    action: action ? { id: action, label: actionLabel(lang) } : null,
  });
});

apiRouter.post('/convert', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new ConversionError('noFile', {}, 400);
    const to = String(req.body.to ?? '').toLowerCase();
    if (!to) throw new ConversionError('missingTarget', {}, 400);

    const request: ConvertRequest = {
      filePath: file.path,
      filename: file.originalname,
      ext: extOf(file.originalname),
      target: to,
      options: parseOptions(req.body as Record<string, unknown>),
    };

    const result = await dispatch(request);
    res.download(result.filePath, result.filename, (err) => {
      cleanup([file.path, result.filePath]);
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    cleanup([req.file?.path]);
    next(err);
  }
});
