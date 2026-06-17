export const IMAGE_NAME = 'image-processing';
export const CSV_NAME = 'csv-import';

export const IMAGE_JOB_NAME = 'ProcessImage';
export const CSV_JOB_NAME = 'ImportCSV';

export interface ImageProcessingPayload {
  imageUrl: string;
  operations: string[]; // e.g., 'resize', 'compress'
  metadata?: Record<string, any>;
}

export interface CsvImportPayload {
  fileUrl: string;
  batchSize: number;
}