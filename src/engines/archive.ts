import { promises as fsp, createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { createGzip, createGunzip } from 'node:zlib';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import unzipper from 'unzipper';
import * as tar from 'tar-stream';
import { outputDir } from '../storage.js';
import { config } from '../config.js';
import { tempName, baseName, extOf } from '../util.js';
import { mimeOf } from '../formats.js';
import { ConversionError } from '../errors.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

export interface ArchiveEntry {
  name: string;
  buffer: Buffer;
}

interface ExtractBudget {
  bytesLeft: number;
  entriesLeft: number;
}

function createBudget(): ExtractBudget {
  return { bytesLeft: config.maxExtractBytes, entriesLeft: config.maxExtractEntries };
}

function takeEntry(budget: ExtractBudget): void {
  if (--budget.entriesLeft < 0) throw new ConversionError('archiveTooLarge', {}, 413);
}

function safeEntryName(name: string): string {
  const parts = path.posix
    .normalize(name.replace(/\\/g, '/').replace(/^[a-zA-Z]:/, ''))
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/') || 'file';
}

async function collectCapped(readable: Readable, budget: ExtractBudget): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > budget.bytesLeft) {
        cb(new ConversionError('archiveTooLarge', {}, 413));
        return;
      }
      chunks.push(chunk);
      cb();
    },
  });
  await pipeline(readable, sink);
  budget.bytesLeft -= size;
  return Buffer.concat(chunks);
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
    archive.file(req.filePath, { name: safeEntryName(req.filename) });
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
  const budget = createBudget();
  const entries: ArchiveEntry[] = [];
  for (const f of dir.files) {
    if (f.type !== 'File') continue;
    takeEntry(budget);
    entries.push({ name: safeEntryName(f.path), buffer: await collectCapped(f.stream() as Readable, budget) });
  }
  return entries;
}

async function tarEntriesFrom(req: ConvertRequest): Promise<ArchiveEntry[]> {
  const budget = createBudget();
  const entries: ArchiveEntry[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.on('end', next);
        stream.resume();
        return;
      }
      const fail = (err: unknown) => {
        extract.destroy();
        reject(err);
      };
      try {
        takeEntry(budget);
      } catch (err) {
        stream.resume();
        fail(err);
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (chunk: unknown) => {
        const buf = chunk as Buffer;
        size += buf.length;
        if (size > budget.bytesLeft) fail(new ConversionError('archiveTooLarge', {}, 413));
        else chunks.push(buf);
      });
      stream.on('end', () => {
        budget.bytesLeft -= size;
        entries.push({ name: safeEntryName(header.name), buffer: Buffer.concat(chunks) });
        next();
      });
      stream.on('error', fail);
    });
    extract.on('finish', () => resolve());
    extract.on('error', reject);
    createReadStream(req.filePath).pipe(extract);
  });
  return entries;
}

async function gzEntry(req: ConvertRequest): Promise<ArchiveEntry> {
  const buffer = await collectCapped(createReadStream(req.filePath).pipe(createGunzip()), createBudget());
  return { name: baseName(req.filename), buffer };
}

export async function extractArchive(req: ConvertRequest): Promise<ConvertResult> {
  const entries = req.ext === 'zip'
    ? await zipEntriesFrom(req)
    : req.ext === 'tar'
      ? await tarEntriesFrom(req)
      : [await gzEntry(req)];

  if (entries.length === 0) throw new ConversionError('emptyArchive');

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
