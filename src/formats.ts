export type Category = 'image' | 'audio' | 'video' | 'document' | 'data' | 'archive' | 'pdf';

export interface CategoryInfo {
  id: string;
  label: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'image', label: 'Images' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'document', label: 'Documents' },
  { id: 'data', label: 'Data' },
  { id: 'archive', label: 'Archives' },
  { id: 'pdf', label: 'PDF' },
];

export const IMAGE_FROM = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'tiff', 'svg'];
export const IMAGE_TO = ['png', 'jpg', 'webp', 'gif', 'avif', 'tiff'];
export const AUDIO = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'];
export const VIDEO = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
export const DOC_FROM = ['docx', 'html', 'md', 'txt', 'rtf', 'odt', 'epub'];
export const DOC_TO = ['docx', 'html', 'md', 'txt', 'rtf', 'odt', 'epub', 'pdf'];
export const DATA = ['csv', 'json', 'xlsx'];
export const ARCHIVE = ['zip', 'tar', 'gz'];

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  avif: 'image/avif', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/opus',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  html: 'text/html', md: 'text/markdown', txt: 'text/plain', rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text', epub: 'application/epub+zip',
  csv: 'text/csv', json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
};

const LABEL: Record<string, string> = {
  png: 'PNG', jpg: 'JPG', webp: 'WebP', gif: 'GIF', avif: 'AVIF', tiff: 'TIFF', svg: 'SVG',
  mp3: 'MP3', wav: 'WAV', ogg: 'OGG', flac: 'FLAC', m4a: 'M4A', aac: 'AAC', opus: 'Opus',
  mp4: 'MP4', webm: 'WebM', mov: 'MOV', avi: 'AVI', mkv: 'MKV',
  docx: 'Word', html: 'HTML', md: 'Markdown', txt: 'TXT', rtf: 'RTF', odt: 'ODT', epub: 'EPUB', pdf: 'PDF',
  csv: 'CSV', json: 'JSON', xlsx: 'Excel',
  zip: 'ZIP', tar: 'TAR', gz: 'GZ',
};

export function mimeOf(ext: string): string {
  return MIME[ext] ?? 'application/octet-stream';
}

export function labelOf(ext: string): string {
  return LABEL[ext] ?? ext.toUpperCase();
}

export function categoryOf(ext: string): Category {
  if (IMAGE_FROM.includes(ext)) return 'image';
  if (AUDIO.includes(ext)) return 'audio';
  if (VIDEO.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (DOC_FROM.includes(ext)) return 'document';
  if (DATA.includes(ext)) return 'data';
  if (ARCHIVE.includes(ext)) return 'archive';
  return 'data';
}

export interface Targets {
  targets: string[];
  action: string | null;
}

export function targetsFor(from: string): Targets {
  if (ARCHIVE.includes(from)) return { targets: [], action: 'extract' };

  const t = new Set<string>();

  if (IMAGE_FROM.includes(from)) IMAGE_TO.forEach((x) => { if (x !== from) t.add(x); });
  if (AUDIO.includes(from)) AUDIO.forEach((x) => { if (x !== from) t.add(x); });
  if (VIDEO.includes(from)) {
    t.add('gif');
    VIDEO.forEach((x) => { if (x !== from) t.add(x); });
    AUDIO.forEach((x) => t.add(x));
  }
  if (from === 'gif') VIDEO.forEach((x) => t.add(x));
  if (DOC_FROM.includes(from)) DOC_TO.forEach((x) => { if (x !== from) t.add(x); });
  if (from === 'pdf') { t.add('png'); t.add('txt'); t.add('docx'); }
  if (DATA.includes(from)) DATA.forEach((x) => { if (x !== from) t.add(x); });

  t.add('zip');
  t.add('tar');
  t.add('gz');

  return { targets: [...t], action: null };
}
