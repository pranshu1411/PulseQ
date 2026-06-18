import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IMAGE_NAME, ImageProcessingPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';

import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

@Processor(IMAGE_NAME)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const compressedDir = path.join(uploadsDir, 'compressed');

    await fs.mkdir(thumbnailsDir, { recursive: true });
    await fs.mkdir(compressedDir, { recursive: true });

    const filename = `${job.id}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, filename);
    const compressedPath = path.join(compressedDir, filename);

    const image = sharp(buffer);
    const metadata = await image.metadata();

    await Promise.all([
      image.clone().resize(150, 150, { fit: 'cover' }).toFile(thumbnailPath),
      image.clone().resize({ width: 800, withoutEnlargement: true }).toFile(compressedPath)
    ]);

    const result = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      thumbnailPath: `uploads/thumbnails/${filename}`,
      compressedPath: `uploads/compressed/${filename}`
    };

    return result;
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} is active`);
    
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'active', attempts: job.attemptsMade },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: job.attemptsMade > 1 ? 'retried' : 'started',
          message: `Job started on attempt ${job.attemptsMade}`,
        },
      }),
    ]);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job, result: any) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} completed successfully`);
    
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          result: result as any,
          completed_at: new Date(),
        },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: 'completed',
          message: 'Job completed successfully',
        },
      }),
    ]);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error) {
    if (!job || !job.id) return;
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
    
    const isPermanent = job.attemptsMade >= (job.opts.attempts || 1);
    
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: isPermanent ? 'failed' : 'delayed',
          error: error.message,
          attempts: job.attemptsMade,
        },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: 'failed',
          message: error.message,
        },
      }),
    ]);
  }
}
