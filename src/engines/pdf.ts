import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { pdfToPng } from 'pdf-to-png-converter';
import { extractText, getDocumentProxy } from 'unpdf';
import { outputDir } from '../storage.js';
import { tempName, baseName } from '../util.js';
import { mimeOf } from '../formats.js';
import { ConversionError } from '../errors.js';
import { zipEntries } from './archive.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

export async function convertPdf(req: ConvertRequest): Promise<ConvertResult> {
  if (req.target === 'png') return toPng(req);
  if (req.target === 'txt') return toTxt(req);
  throw new ConversionError('unsupportedPdfTarget', { target: req.target }, 400);
}

async function toPng(req: ConvertRequest): Promise<ConvertResult> {
  const pages = await pdfToPng(req.filePath, { viewportScale: 2.0, returnPageContent: true });
  const buffers = pages
    .filter((p) => p.kind === 'content' && p.content)
    .map((p) => p.content as Buffer);

  if (buffers.length === 0) throw new ConversionError('emptyPdf');

  if (buffers.length === 1) {
    const outPath = path.join(outputDir, tempName('png'));
    await fsp.writeFile(outPath, buffers[0]);
    return { filePath: outPath, filename: `${baseName(req.filename)}.png`, mime: mimeOf('png') };
  }

  const entries = buffers.map((b, i) => ({ name: `${baseName(req.filename)}-page-${i + 1}.png`, buffer: b }));
  const outPath = path.join(outputDir, tempName('zip'));
  await zipEntries(entries, outPath);
  return { filePath: outPath, filename: `${baseName(req.filename)}.zip`, mime: mimeOf('zip') };
}

async function toTxt(req: ConvertRequest): Promise<ConvertResult> {
  const data = await fsp.readFile(req.filePath);
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const outPath = path.join(outputDir, tempName('txt'));
  await fsp.writeFile(outPath, text, 'utf8');
  return { filePath: outPath, filename: `${baseName(req.filename)}.txt`, mime: mimeOf('txt') };
}
