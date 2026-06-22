import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  IMAGE_NAME,
  ImageProcessingPayload,
  StorageService,
} from '@app/shared';
import { PrismaService } from '@app/prisma';
import { BaseProcessor } from './base.processor';

import sharp from 'sharp';
import { Readable } from 'stream';
import * as https from 'https';
import * as http from 'http';

@Processor(IMAGE_NAME, {
  concurrency: 5,
  limiter: {
    max: 100,
    duration: 60000,
  },
})
export class ImageProcessor extends BaseProcessor {
  protected readonly logger = new Logger(ImageProcessor.name);

  constructor(
    protected readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    super(prisma);
  }

  async streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private fetchExternalUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
        // Follow redirects (301/302)
        if (res.statusCode && (res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return resolve(this.fetchExternalUrl(res.headers.location));
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  async process(job: Job<ImageProcessingPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    const dbJob = await this.prisma.job.findUnique({ where: { id: job.id } });
    if (!dbJob) throw new Error('Job not found in DB');
    const userId = dbJob.userId;

    const { imageUrl } = job.data;

    let buffer: Buffer;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      this.logger.log(`Fetching image from external URL: ${imageUrl}`);
      buffer = await this.fetchExternalUrl(imageUrl);
    } else {
      this.logger.log(`Downloading image from MinIO: ${imageUrl}`);
      const stream = await this.storageService.getFileStream(imageUrl);
      buffer = await this.streamToBuffer(stream);
    }

    const filename = `${job.id}.jpg`;
    const thumbnailPath = `thumbnails/${filename}`;
    const compressedPath = `compressed/${filename}`;

    const image = sharp(buffer);
    const metadata = await image.metadata();

    const thumbnailBuffer = await image
      .clone()
      .resize(150, 150, { fit: 'cover' })
      .toBuffer();
    const compressedBuffer = await image
      .clone()
      .resize({ width: 800, withoutEnlargement: true })
      .toBuffer();

    await this.storageService.uploadBuffer(
      thumbnailBuffer,
      thumbnailPath,
      'image/jpeg',
    );
    await this.storageService.uploadBuffer(
      compressedBuffer,
      compressedPath,
      'image/jpeg',
    );

    const result = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      thumbnailPath,
      compressedPath,
    };

    this.logger.log('Saving image record to database...');
    await this.prisma.imageRecord.create({
      data: {
        userId,
        jobId: job.id,
        originalUrl: imageUrl,
        thumbnailPath: result.thumbnailPath,
        compressedPath: result.compressedPath,
        format: result.format,
        width: result.width,
        height: result.height,
      },
    });

    // Guarantee DB is updated BEFORE process() returns to prevent shutdown race conditions
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'completed', result: result, completed_at: new Date() },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: 'completed',
          message: 'Job completed successfully',
        },
      }),
    ]);

    return result;
  }
}
