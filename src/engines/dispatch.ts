import { detectCapabilities } from '../capabilities.js';
import { ConversionError } from '../errors.js';
import { IMAGE_FROM, IMAGE_TO, AUDIO, VIDEO, DOC_FROM, DOC_TO, DATA, ARCHIVE } from '../formats.js';
import { convertImage } from './image.js';
import { convertMedia } from './media.js';
import { convertData } from './data.js';
import { convertDocument } from './document.js';
import { convertPdf } from './pdf.js';
import { compressToArchive, extractArchive } from './archive.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

type Caps = ReturnType<typeof detectCapabilities>;

function requireFfmpeg(caps: Caps): void {
  if (!caps.ffmpeg) throw new ConversionError('FFmpeg is not installed on the server', 503);
}

function requirePandoc(caps: Caps): void {
  if (!caps.pandoc) throw new ConversionError('Pandoc is not installed on the server', 503);
}

function requireLibreoffice(caps: Caps): void {
  if (!caps.libreoffice) throw new ConversionError('LibreOffice is not installed on the server', 503);
}

export async function dispatch(req: ConvertRequest): Promise<ConvertResult> {
  const caps = detectCapabilities();

  if (req.target === 'extract') return extractArchive(req);
  if (ARCHIVE.includes(req.target)) return compressToArchive(req);

  if (IMAGE_FROM.includes(req.ext) && IMAGE_TO.includes(req.target)) return convertImage(req);

  if (AUDIO.includes(req.ext) && AUDIO.includes(req.target)) {
    requireFfmpeg(caps);
    return convertMedia(req);
  }
  if (VIDEO.includes(req.ext) && AUDIO.includes(req.target)) {
    requireFfmpeg(caps);
    return convertMedia(req);
  }
  if (VIDEO.includes(req.ext) && (VIDEO.includes(req.target) || req.target === 'gif')) {
    requireFfmpeg(caps);
    return convertMedia(req);
  }
  if (req.ext === 'gif' && VIDEO.includes(req.target)) {
    requireFfmpeg(caps);
    return convertMedia(req);
  }

  if (DATA.includes(req.ext) && DATA.includes(req.target)) return convertData(req);

  if (DOC_FROM.includes(req.ext) && DOC_TO.includes(req.target)) {
    if (req.target === 'pdf') {
      requireLibreoffice(caps);
      if (req.ext === 'md' || req.ext === 'epub') requirePandoc(caps);
    } else {
      requirePandoc(caps);
    }
    return convertDocument(req);
  }
  if (req.ext === 'pdf' && req.target === 'docx') {
    requireLibreoffice(caps);
    return convertDocument(req);
  }
  if (req.ext === 'pdf' && (req.target === 'png' || req.target === 'txt')) return convertPdf(req);

  throw new ConversionError(`Conversion from .${req.ext} to .${req.target} is not supported`, 400);
}
