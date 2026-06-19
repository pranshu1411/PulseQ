import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IMAGE_NAME, ImageProcessingPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';
import { BaseProcessor } from './base.processor';

import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

@Processor(IMAGE_NAME)
export class ImageProcessor extends BaseProcessor {
  protected readonly logger = new Logger(ImageProcessor.name);

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async process(job: Job<ImageProcessingPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    const { imageUrl } = job.data;
    this.logger.log(`Downloading image from: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: expected image/*, got ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), 'apps', 'worker', 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const compressedDir = path.join(uploadsDir, 'compressed');

    await fs.mkdir(thumbnailsDir, { recursive: true });
    await fs.mkdir(compressedDir, { recursive: true });

    const filename = `${job.id}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, filename);
    const compressedPath = path.join(compressedDir, filename);

    const image = sharp(buffer);
    const metadata = await image.metadata();

    await image.clone().resize(150, 150, { fit: 'cover' }).toFile(thumbnailPath);
    await image.clone().resize({ width: 800, withoutEnlargement: true }).toFile(compressedPath);

    const result = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      thumbnailPath: `apps/worker/uploads/thumbnails/${filename}`,
      compressedPath: `apps/worker/uploads/compressed/${filename}`
    };

    this.logger.log('Saving image record to database...');
    await this.prisma.imageRecord.create({
      data: {
        originalUrl: imageUrl,
        thumbnailPath: result.thumbnailPath,
        compressedPath: result.compressedPath,
        format: result.format,
        width: result.width,
        height: result.height
      }
    });

    return result;
  }
}
