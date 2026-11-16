import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function canonicalExt(raw: string): string {
  const ext = raw.trim().toLowerCase().replace(/^\./, '');
  return ext === 'jpeg' ? 'jpg' : ext;
}

export function extOf(filename: string): string {
  return canonicalExt(path.extname(filename));
}

export function baseName(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

export function tempName(ext: string): string {
  return `${randomUUID()}.${ext}`;
}
