import { IsString, IsUrl, IsArray, IsOptional, IsObject, IsNumber, Min } from 'class-validator';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}


export const IMAGE_NAME = 'image-processing';
export const CSV_NAME = 'csv-import';

export const IMAGE_JOB_NAME = 'ProcessImage';
export const CSV_JOB_NAME = 'ImportCSV';

export class ImageProcessingPayload {
  @IsOptional()
  @IsString()
  jobName?: string;

  @IsUrl({ require_tld: false })
  imageUrl: string;

  @IsArray()
  @IsString({ each: true })
  operations: string[]; // e.g., 'resize', 'compress'

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CsvImportPayload {
  @IsOptional()
  @IsString()
  jobName?: string;

  @IsUrl({ require_tld: false })
  fileUrl: string;

  @IsNumber()
  @Min(1)
  batchSize: number;
}

export * from './storage.service';
export * from './storage.module';