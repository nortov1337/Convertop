import { mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.join(os.tmpdir(), 'convertop');
export const uploadDir = path.join(root, 'uploads');
export const outputDir = path.join(root, 'outputs');

export function ensureDirs(): void {
  mkdirSync(uploadDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
}

export function cleanupTemp(ttlMs: number): void {
  for (const dir of [uploadDir, outputDir]) {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    const now = Date.now();
    for (const name of names) {
      const p = path.join(dir, name);
      try {
        if (now - statSync(p).mtimeMs > ttlMs) rmSync(p, { force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}
