import { WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@app/prisma';

export abstract class BaseProcessor extends WorkerHost {
  protected abstract readonly logger: Logger;

  constructor(protected readonly prisma: PrismaService) {
    super();
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} is active`);

    try {
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
    } catch (error) {
      this.logger.error(`Failed to log active state for job ${job.id}:`, error);
    }
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job, result: any) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} completed successfully`);

    try {
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
    } catch (error) {
      this.logger.error(`Failed to log completion state for job ${job.id}:`, error);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error) {
    if (!job || !job.id) return;
    this.logger.error(`Job ${job.id} failed: ${error.message}`);

    const isPermanent = job.attemptsMade >= (job.opts.attempts || 1);

    try {
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
    } catch (dbError) {
      this.logger.error(`Failed to log failure state for job ${job.id}:`, dbError);
    }
  }
}
