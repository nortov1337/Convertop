import { spawnSync } from 'node:child_process';

export interface Capabilities {
  ffmpeg: boolean;
  pandoc: boolean;
  libreoffice: boolean;
}

function present(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { stdio: 'ignore', timeout: 5000, windowsHide: true });
  return r.error === undefined;
}

let cache: Capabilities | null = null;

export function detectCapabilities(): Capabilities {
  if (!cache) {
    cache = {
      ffmpeg: present('ffmpeg', ['-version']),
      pandoc: present('pandoc', ['--version']),
      libreoffice: present('soffice', ['--version']) || present('libreoffice', ['--version']),
    };
  }
  return cache;
}
