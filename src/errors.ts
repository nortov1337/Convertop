import { errorMessage } from './locales.js';
import type { ErrorCode, ErrorParams } from './locales.js';

export class ConversionError extends Error {
  constructor(readonly code: ErrorCode, readonly params: ErrorParams = {}, readonly status = 422) {
    super(errorMessage(code, 'en', params));
    this.name = 'ConversionError';
  }
}
