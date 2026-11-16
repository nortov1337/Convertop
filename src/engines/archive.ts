import { promises as fsp, createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import unzipper from 'unzipper';
import * as tar from 'tar-stream';
import { outputDir } from '../storage.js';
import { tempName, baseName, extOf } from '../util.js';
import { mimeOf } from '../formats.js';
import { ConversionError } from '../errors.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

export interface ArchiveEntry {
  name: string;
  buffer: Buffer;
}

export async function zipEntries(entries: ArchiveEntry[], outPath: string): Promise<void> {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const ws = createWriteStream(outPath);
  const done = new Promise<void>((resolve, reject) => {
    ws.on('close', () => resolve());
    ws.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(ws);
  for (const e of entries) archive.append(e.buffer, { name: e.name });
  await archive.finalize();
  await done;
}

export async function compressToArchive(req: ConvertRequest): Promise<ConvertResult> {
  const outPath = path.join(outputDir, tempName(req.target));

  if (req.target === 'zip' || req.target === 'tar') {
    const archive = archiver(req.target, { zlib: { level: 9 } });
    const ws = createWriteStream(outPath);
    const done = new Promise<void>((resolve, reject) => {
      ws.on('close', () => resolve());
      ws.on('error', reject);
      archive.on('error', reject);
    });
    archive.pipe(ws);
    archive.file(req.filePath, { name: req.filename });
    await archive.finalize();
    await done;
    return { filePath: outPath, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
  }

  const ws = createWriteStream(outPath);
  await pipeline(createReadStream(req.filePath), createGzip({ level: 9 }), ws);
  return { filePath: outPath, filename: `${req.filename}.gz`, mime: mimeOf('gz') };
}

async function zipEntriesFrom(req: ConvertRequest): Promise<ArchiveEntry[]> {
  const dir = await unzipper.Open.file(req.filePath);
  const entries: ArchiveEntry[] = [];
  for (const f of dir.files) {
    if (f.type !== 'File') continue;
    entries.push({ name: f.path, buffer: await f.buffer() });
  }
  return entries;
}

async function tarEntriesFrom(req: ConvertRequest): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.type === 'file') {
        const chunks: Buffer[] = [];
        stream.on('data', (c: unknown) => chunks.push(c as Buffer));
        stream.on('end', () => {
          entries.push({ name: header.name, buffer: Buffer.concat(chunks) });
          next();
        });
        stream.on('error', next);
      } else {
        stream.on('end', next);
        stream.resume();
      }
    });
    extract.on('finish', () => resolve());
    extract.on('error', reject);
    createReadStream(req.filePath).pipe(extract);
  });
  return entries;
}

async function gzEntry(req: ConvertRequest): Promise<ArchiveEntry> {
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  await pipeline(createReadStream(req.filePath), createGunzip(), sink);
  return { name: baseName(req.filename), buffer: Buffer.concat(chunks) };
}

export async function extractArchive(req: ConvertRequest): Promise<ConvertResult> {
  const entries = req.ext === 'zip'
    ? await zipEntriesFrom(req)
    : req.ext === 'tar'
      ? await tarEntriesFrom(req)
      : [await gzEntry(req)];

  if (entries.length === 0) throw new ConversionError('Archive contains no files', 422);

  if (entries.length === 1) {
    const e = entries[0];
    const ext = extOf(e.name);
    const outPath = path.join(outputDir, tempName(ext || 'bin'));
    await fsp.writeFile(outPath, e.buffer);
    return { filePath: outPath, filename: path.basename(e.name), mime: mimeOf(ext) };
  }

  const outPath = path.join(outputDir, tempName('zip'));
  await zipEntries(entries, outPath);
  return { filePath: outPath, filename: `${baseName(req.filename)}-extracted.zip`, mime: mimeOf('zip') };
}
