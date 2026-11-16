import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { outputDir } from '../storage.js';
import { tempName, baseName } from '../util.js';
import { mimeOf } from '../formats.js';
import { run } from '../run.js';
import { config } from '../config.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

async function sofficeConvert(input: string, fmt: string): Promise<string> {
  const outDir = path.join(outputDir, tempName('out'));
  await fsp.mkdir(outDir, { recursive: true });
  await run('soffice', ['--headless', '--convert-to', fmt, '--outdir', outDir, input], config.convertTimeoutMs);
  return path.join(outDir, `${path.basename(input, path.extname(input))}.${fmt}`);
}

async function sofficeToPdf(req: ConvertRequest): Promise<string> {
  let input = req.filePath;
  let tmpHtml: string | null = null;
  if (req.ext === 'md' || req.ext === 'epub') {
    tmpHtml = path.join(outputDir, tempName('html'));
    await run('pandoc', ['-f', req.ext, '-t', 'html', '-o', tmpHtml, req.filePath], config.convertTimeoutMs);
    input = tmpHtml;
  }
  const produced = await sofficeConvert(input, 'pdf');
  if (tmpHtml) fsp.rm(tmpHtml, { force: true }).catch(() => {});
  return produced;
}

export async function convertDocument(req: ConvertRequest): Promise<ConvertResult> {
  let produced: string;

  if (req.ext === 'pdf') {
    produced = await sofficeConvert(req.filePath, req.target);
  } else if (req.target === 'pdf') {
    produced = await sofficeToPdf(req);
  } else {
    const outPath = path.join(outputDir, tempName(req.target));
    await run('pandoc', ['-f', req.ext, '-t', req.target, '-o', outPath, req.filePath], config.convertTimeoutMs);
    return { filePath: outPath, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
  }

  return { filePath: produced, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
}
