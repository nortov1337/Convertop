import type { Category } from './formats.js';

export type Lang = 'ru' | 'en';

export interface ErrorParams {
  ext?: string;
  target?: string;
}

export type ErrorCode =
  | 'noFile'
  | 'missingTarget'
  | 'badFrom'
  | 'unsupportedConversion'
  | 'unsupportedImageTarget'
  | 'unsupportedMediaConversion'
  | 'unsupportedPdfTarget'
  | 'emptyPdf'
  | 'emptyArchive'
  | 'missingFfmpeg'
  | 'missingPandoc'
  | 'missingLibreoffice'
  | 'fileTooLarge'
  | 'uploadFailed'
  | 'internal';

const CATEGORY_LABELS: Record<Lang, Record<Category, string>> = {
  en: {
    image: 'Images',
    audio: 'Audio',
    video: 'Video',
    document: 'Documents',
    data: 'Data',
    archive: 'Archives',
    pdf: 'PDF',
  },
  ru: {
    image: 'Изображения',
    audio: 'Аудио',
    video: 'Видео',
    document: 'Документы',
    data: 'Данные',
    archive: 'Архивы',
    pdf: 'PDF',
  },
};

const ACTION_LABELS: Record<Lang, string> = {
  en: 'Extract contents',
  ru: 'Распаковать',
};

const MESSAGES: Record<Lang, Record<ErrorCode, string>> = {
  en: {
    noFile: 'No file uploaded (field name must be "file")',
    missingTarget: 'Missing "to" target format',
    badFrom: 'Missing or empty "from" extension',
    unsupportedConversion: 'Conversion from .{ext} to .{target} is not supported',
    unsupportedImageTarget: 'Unsupported image target: {target}',
    unsupportedMediaConversion: 'Unsupported media conversion: {ext} -> {target}',
    unsupportedPdfTarget: 'Unsupported PDF target: {target}',
    emptyPdf: 'PDF produced no pages',
    emptyArchive: 'Archive contains no files',
    missingFfmpeg: 'FFmpeg is not installed on the server',
    missingPandoc: 'Pandoc is not installed on the server',
    missingLibreoffice: 'LibreOffice is not installed on the server',
    fileTooLarge: 'File exceeds the size limit',
    uploadFailed: 'Upload failed',
    internal: 'Internal server error',
  },
  ru: {
    noFile: 'Файл не загружен (имя поля должно быть "file")',
    missingTarget: 'Не указан целевой формат ("to")',
    badFrom: 'Не указано расширение файла ("from")',
    unsupportedConversion: 'Конвертация из .{ext} в .{target} не поддерживается',
    unsupportedImageTarget: 'Неподдерживаемый формат изображения: {target}',
    unsupportedMediaConversion: 'Неподдерживаемая конвертация медиа: {ext} → {target}',
    unsupportedPdfTarget: 'Неподдерживаемый формат для PDF: {target}',
    emptyPdf: 'PDF не содержит страниц',
    emptyArchive: 'Архив не содержит файлов',
    missingFfmpeg: 'FFmpeg не установлен на сервере',
    missingPandoc: 'Pandoc не установлен на сервере',
    missingLibreoffice: 'LibreOffice не установлен на сервере',
    fileTooLarge: 'Файл превышает допустимый размер',
    uploadFailed: 'Не удалось загрузить файл',
    internal: 'Внутренняя ошибка сервера',
  },
};

export function langFrom(header: string | undefined): Lang {
  return (header ?? '').trim().toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function categoryLabels(lang: Lang): Record<Category, string> {
  return CATEGORY_LABELS[lang];
}

export function actionLabel(lang: Lang): string {
  return ACTION_LABELS[lang];
}

export function errorMessage(code: ErrorCode, lang: Lang, params: ErrorParams = {}): string {
  return MESSAGES[lang][code].replace(/\{(\w+)\}/g, (_, key: keyof ErrorParams) => params[key] ?? '');
}
