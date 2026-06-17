import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IMAGE_NAME, ImageProcessingPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';

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

    // 1. Simulate processing logic
    const { imageUrl } = job.data;
    this.logger.log(`Verifying image URL: ${imageUrl}`);

    const response = await fetch(imageUrl, {
      method: 'HEAD',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const result = { success: true, processedUrl: 'https://example.com/processed.jpg' };
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
