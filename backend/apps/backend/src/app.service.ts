import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { QUEUE_NAME, JobPayload } from '@app/shared';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(QUEUE_NAME) private readonly imageQueue: Queue,
    private readonly prisma: PrismaService,
  ) { }

  async createJob(payload: JobPayload) {
    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: 'ProcessImage',
        queue_name: QUEUE_NAME,
        status: 'queued',
        payload: payload as any,
      },
    });

    try {
      // 2. Add job to BullMQ Redis Queue
      // We pass the Postgres Job ID as the BullMQ Job ID so they map 1:1
      const bullJob = await this.imageQueue.add('ProcessImage', payload, {
        jobId: dbJob.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        message: 'Job created successfully',
        jobId: dbJob.id,
      };
    } catch (error) {
      // If Redis fails, update DB status to failed
      await this.prisma.job.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to enqueue',
        },
      });
      throw new InternalServerErrorException('Failed to enqueue job');
    }
  }

  async getJobById(jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return job;
  }

  async getAllJobs() {
    return this.prisma.job.findMany({
      orderBy: { created_at: 'desc' },
    });
  }
}
