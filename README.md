# Convertop

Self-hosted file converter: a drag-and-drop web interface and a REST API. Conversion runs locally on the server, and files are deleted automatically.

## Features

| Category | Formats | Engine |
| --- | --- | --- |
| Images | PNG, JPG, WebP, GIF, AVIF, TIFF, SVG → | sharp (no system dependencies) |
| Audio | MP3, WAV, OGG, FLAC, M4A, AAC, Opus | FFmpeg |
| Video | MP4, WebM, MOV, AVI, MKV, GIF (+ audio extraction) | FFmpeg |
| Documents | DOCX, HTML, MD, TXT, RTF, ODT, EPUB, PDF | Pandoc + LibreOffice |
| Data | CSV, JSON, XLSX | exceljs / csv |
| Archives | ZIP, TAR, GZ (pack and extract) | archiver / unzipper / tar-stream |
| PDF | → PNG, TXT, DOCX | pdf-to-png-converter / unpdf / LibreOffice |

## Running

```bash
npm install
npm run dev        # development (tsx watch)
npm run build      # build to dist/
npm start          # production on :3000
```

Open http://localhost:3000.

### System dependencies

- **FFmpeg** — audio/video (on Windows: download from ffmpeg.org and add to PATH).
- **Pandoc** — documents (pandoc.org/installing.html).
- **LibreOffice** — export to PDF and back (libreoffice.org).

Images, data, archives and PDF→PNG/TXT work without these tools. Available engines are reported by `GET /api/health`.

## Docker (Linux)

```bash
docker build -t convertop .
docker run -p 3000:3000 convertop
```

The image already includes FFmpeg, Pandoc and LibreOffice.

## API

- `GET /api/health` — status and available engines.
- `GET /api/formats` — format categories.
- `GET /api/targets?from=png` — list of target formats for an extension.
- `POST /api/convert` — multipart: `file`, `to`, optionally `quality` (1–100). Returns the file.

Labels and error messages are localized: send `Accept-Language: ru` (or `en`, the default) to get them in the chosen language.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port |
| `MAX_UPLOAD_BYTES` | `524288000` | Maximum file size |
| `CONVERT_TIMEOUT_MS` | `900000` | Conversion timeout |
| `TEMP_TTL_MS` | `3600000` | Temporary file lifetime |
