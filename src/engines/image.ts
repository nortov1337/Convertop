import path from 'node:path';
import sharp from 'sharp';
import { outputDir } from '../storage.js';
import { tempName, baseName } from '../util.js';
import { mimeOf } from '../formats.js';
import { ConversionError } from '../errors.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

export async function convertImage(req: ConvertRequest): Promise<ConvertResult> {
  const outPath = path.join(outputDir, tempName(req.target));
  const quality = req.options.quality ?? 90;
  let pipeline = sharp(req.filePath, { failOn: 'error' }).rotate();

  switch (req.target) {
    case 'png': pipeline = pipeline.png({ compressionLevel: 9 }); break;
    case 'jpg': pipeline = pipeline.jpeg({ quality, mozjpeg: true }); break;
    case 'webp': pipeline = pipeline.webp({ quality }); break;
    case 'avif': pipeline = pipeline.avif({ quality }); break;
    case 'tiff': pipeline = pipeline.tiff({ compression: 'lzw' }); break;
    case 'gif': pipeline = pipeline.gif(); break;
    default: throw new ConversionError(`Unsupported image target: ${req.target}`, 400);
  }

  await pipeline.toFile(outPath);
  return { filePath: outPath, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
}
