import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CSV_NAME, CsvImportPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';

@Processor(CSV_NAME)
export class CsvProcessor extends WorkerHost {
  private readonly logger = new Logger(CsvProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CsvImportPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    const { fileUrl, batchSize } = job.data;
    this.logger.log(`Importing CSV from ${fileUrl} with batch size ${batchSize}`);

    // Simulate CSV processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return { success: true, rowsProcessed: 1000 };
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
