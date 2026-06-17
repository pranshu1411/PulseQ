export const QUEUE_NAME = 'image-processing';

export interface ImageProcessingPayload {
  imageUrl: string;
  operations: string[]; // e.g., 'resize', 'compress'
  metadata?: Record<string, any>;
}

export interface CsvImportPayload {
  fileUrl: string;
  batchSize: number;
}

export type JobPayload = ImageProcessingPayload | CsvImportPayload;
