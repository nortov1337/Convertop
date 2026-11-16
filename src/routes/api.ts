import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { uploadDir, outputDir } from '../storage.js';
import { config } from '../config.js';
import { extOf, canonicalExt, parsePages, baseName, tempName } from '../util.js';
import { targetsFor, categoryOf, labelOf, mimeOf, CATEGORIES } from '../formats.js';
import { detectCapabilities } from '../capabilities.js';
import { dispatch } from '../engines/dispatch.js';
import { zipEntries } from '../engines/archive.js';
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

apiRouter.get('/formats', (_req, res) => {
  res.json({ capabilities: detectCapabilities(), categories: CATEGORIES });
});

apiRouter.get('/targets', (req, res) => {
  const from = canonicalExt(String(req.query.from ?? ''));
  if (!from) return res.status(400).json({ error: 'Missing or empty "from" extension' });
  const { targets, action } = targetsFor(from);
  res.json({
    from,
    category: categoryOf(from),
    targets: targets.map((ext) => ({ ext, label: labelOf(ext), category: categoryOf(ext), mime: mimeOf(ext) })),
    action: action ? { id: action, label: 'Извлечь содержимое' } : null,
  });
});

apiRouter.post('/convert', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new ConversionError('No file uploaded (field name must be "file")', 400);
    const to = String(req.body.to ?? '').toLowerCase();
    if (!to) throw new ConversionError('Missing "to" target format', 400);

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

apiRouter.post('/pdf/merge', upload.array('files', 20), async (req, res, next) => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length < 2) throw new ConversionError('Provide at least two PDF files', 400);

    const merged = await PDFDocument.create();
    for (const f of files) {
      const doc = await PDFDocument.load(await fsp.readFile(f.path));
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      for (const p of pages) merged.addPage(p);
    }

    const outPath = path.join(outputDir, tempName('pdf'));
    await fsp.writeFile(outPath, await merged.save());
    const paths = files.map((f) => f.path);
    res.download(outPath, 'merged.pdf', (err) => {
      cleanup([outPath, ...paths]);
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    cleanup(((req.files ?? []) as Express.Multer.File[]).map((f) => f.path));
    next(err);
  }
});

apiRouter.post('/pdf/split', upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw new ConversionError('No file uploaded', 400);

    const doc = await PDFDocument.load(await fsp.readFile(file.path));
    const total = doc.getPageCount();
    const spec = typeof req.body.pages === 'string' ? req.body.pages : undefined;
    const selected = parsePages(spec) ?? Array.from({ length: total }, (_v, i) => i + 1);
    const valid = selected.filter((n) => n >= 1 && n <= total);
    if (valid.length === 0) throw new ConversionError('No valid pages selected', 400);

    const entries: Array<{ name: string; buffer: Buffer }> = [];
    for (const n of valid) {
      const single = await PDFDocument.create();
      const [p] = await single.copyPages(doc, [n - 1]);
      single.addPage(p);
      entries.push({ name: `${baseName(file.originalname)}-page-${n}.pdf`, buffer: Buffer.from(await single.save()) });
    }

    const outPath = path.join(outputDir, tempName('zip'));
    await zipEntries(entries, outPath);
    res.download(outPath, `${baseName(file.originalname)}-split.zip`, (err) => {
      cleanup([file.path, outPath]);
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    cleanup([req.file?.path]);
    next(err);
  }
});
