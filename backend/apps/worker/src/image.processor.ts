import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAME, JobPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';

@Processor(QUEUE_NAME)
export class ImageProcessor extends WorkerHost {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<JobPayload, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    // 1. Mark job as active in DB
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: 'active', updated_at: new Date() },
    });

    try {
      // 2. Simulate processing logic
      this.logger.log(`Payload received: ${JSON.stringify(job.data)}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = { success: true, processedUrl: 'https://example.com/processed.jpg' };

      // 3. Mark job as completed
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          result: result as any,
          completed_at: new Date()
        },
      });

      this.logger.log(`Job ${job.id} completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error}`);

      // Mark job as failed (if it runs out of attempts, BullMQ marks it failed permanently)
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date()
        },
      });
      throw error;
    }
  }
}
