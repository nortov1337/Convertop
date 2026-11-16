export const config = {
  port: Number(process.env.PORT ?? 3000),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 500 * 1024 * 1024),
  maxExtractBytes: Number(process.env.MAX_EXTRACT_BYTES ?? 2 * 1024 * 1024 * 1024),
  maxExtractEntries: Number(process.env.MAX_EXTRACT_ENTRIES ?? 10000),
  convertTimeoutMs: Number(process.env.CONVERT_TIMEOUT_MS ?? 15 * 60 * 1000),
  tempTtlMs: Number(process.env.TEMP_TTL_MS ?? 60 * 60 * 1000),
} as const;
