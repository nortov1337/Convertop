import path from 'node:path';
import { outputDir } from '../storage.js';
import { tempName, baseName } from '../util.js';
import { mimeOf, AUDIO, VIDEO } from '../formats.js';
import { run } from '../run.js';
import { config } from '../config.js';
import { ConversionError } from '../errors.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

const AUDIO_ARGS: Record<string, string[]> = {
  mp3: ['-c:a', 'libmp3lame', '-b:a', '192k'],
  wav: ['-c:a', 'pcm_s16le'],
  ogg: ['-c:a', 'libvorbis', '-q:a', '4'],
  flac: ['-c:a', 'flac'],
  m4a: ['-c:a', 'aac', '-b:a', '192k'],
  aac: ['-c:a', 'aac', '-b:a', '192k'],
  opus: ['-c:a', 'libopus', '-b:a', '128k'],
};

const VIDEO_ARGS: Record<string, string[]> = {
  mp4: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'],
  webm: ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k'],
  mov: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'],
  avi: ['-c:v', 'mpeg4', '-q:v', '4', '-c:a', 'libmp3lame', '-b:a', '192k'],
  mkv: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'],
};

export async function convertMedia(req: ConvertRequest): Promise<ConvertResult> {
  const outPath = path.join(outputDir, tempName(req.target));
  const args = ['-y', '-i', req.filePath];

  if (VIDEO.includes(req.ext) && AUDIO.includes(req.target)) {
    args.push(...AUDIO_ARGS[req.target], '-vn');
  } else if (VIDEO.includes(req.ext) && req.target === 'gif') {
    args.push(
      '-vf',
      'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
      '-loop', '0',
    );
  } else if (AUDIO.includes(req.ext) && AUDIO.includes(req.target)) {
    args.push(...AUDIO_ARGS[req.target]);
  } else if ((VIDEO.includes(req.ext) || req.ext === 'gif') && VIDEO.includes(req.target)) {
    args.push(...VIDEO_ARGS[req.target]);
  } else {
    throw new ConversionError(`Unsupported media conversion: ${req.ext} -> ${req.target}`, 400);
  }

  args.push(outPath);
  await run('ffmpeg', args, config.convertTimeoutMs);
  return { filePath: outPath, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
}
