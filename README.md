# Convertop

Самодостаточный конвертер файлов: веб-интерфейс с drag-and-drop и REST API. Конвертация выполняется локально на сервере, файлы удаляются автоматически.

## Возможности

| Категория | Форматы | Движок |
| --- | --- | --- |
| Изображения | PNG, JPG, WebP, GIF, AVIF, TIFF, SVG → | sharp (без системных зависимостей) |
| Аудио | MP3, WAV, OGG, FLAC, M4A, AAC, Opus | FFmpeg |
| Видео | MP4, WebM, MOV, AVI, MKV, GIF (+ извлечение аудио) | FFmpeg |
| Документы | DOCX, HTML, MD, TXT, RTF, ODT, EPUB, PDF | Pandoc + LibreOffice |
| Данные | CSV, JSON, XLSX | exceljs / csv |
| Архивы | ZIP, TAR, GZ (упаковка и извлечение) | archiver / unzipper / tar-stream |
| PDF | → PNG, TXT; объединение и разделение страниц | pdf-to-png-converter / unpdf / pdf-lib |

## Запуск

```bash
npm install
npm run dev        # разработка (tsx watch)
npm run build      # сборка в dist/
npm start          # продакшн на :3000
```

Откройте http://localhost:3000.

### Системные зависимости

- **FFmpeg** — аудио/видео (на Windows: скачать с ffmpeg.org и добавить в PATH).
- **Pandoc** — документы (pandoc.org/installing.html).
- **LibreOffice** — экспорт в PDF и обратно (libreoffice.org).

Изображения, данные, архивы и PDF→PNG/TXT работают без этих инструментов. Доступные движки видны на `GET /api/health`.

## Docker (Linux)

```bash
docker build -t convertop .
docker run -p 3000:3000 convertop
```

Образ уже включает FFmpeg, Pandoc и LibreOffice.

## API

- `GET /api/health` — статус и доступные движки.
- `GET /api/formats` — категории форматов.
- `GET /api/targets?from=png` — список целевых форматов для расширения.
- `POST /api/convert` — multipart: `file`, `to`, опционально `quality` (1–100). Возвращает файл.
- `POST /api/pdf/merge` — multipart: `files[]` (≥2). Возвращает PDF.
- `POST /api/pdf/split` — multipart: `file`, опционально `pages` (`1-3,5`). Возвращает ZIP.

## Переменные окружения

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `PORT` | `3000` | Порт |
| `MAX_UPLOAD_BYTES` | `524288000` | Максимальный размер файла |
| `CONVERT_TIMEOUT_MS` | `900000` | Таймаут конвертации |
| `TEMP_TTL_MS` | `3600000` | Время жизни временных файлов |
