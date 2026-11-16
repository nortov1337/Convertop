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

export function parsePages(spec: string | undefined): number[] | null {
  if (!spec) return null;
  const pages = new Set<number>();
  for (const part of spec.split(',')) {
    const chunk = part.trim();
    const m = chunk.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.add(i);
  }
  return pages.size ? [...pages].sort((x, y) => x - y) : null;
}
