export class ConversionError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = 'ConversionError';
  }
}
