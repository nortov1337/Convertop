export interface ConvertOptions {
  quality?: number;
  password?: string;
}

export interface ConvertRequest {
  filePath: string;
  filename: string;
  ext: string;
  target: string;
  options: ConvertOptions;
}

export interface ConvertResult {
  filePath: string;
  filename: string;
  mime: string;
}
