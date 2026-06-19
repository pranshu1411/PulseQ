import { IsString, IsUrl, IsArray, IsOptional, IsObject, IsNumber, Min } from 'class-validator';

export const IMAGE_NAME = 'image-processing';
export const CSV_NAME = 'csv-import';

export const IMAGE_JOB_NAME = 'ProcessImage';
export const CSV_JOB_NAME = 'ImportCSV';

export class ImageProcessingPayload {
  @IsUrl()
  imageUrl: string;

  @IsArray()
  @IsString({ each: true })
  operations: string[]; // e.g., 'resize', 'compress'

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CsvImportPayload {
  @IsUrl({ require_tld: false })
  fileUrl: string;

  @IsNumber()
  @Min(1)
  batchSize: number;
}