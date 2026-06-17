import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { IMAGE_NAME, ImageProcessingPayload, CSV_NAME, CsvImportPayload, IMAGE_JOB_NAME, CSV_JOB_NAME } from '@app/shared';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(IMAGE_NAME) private readonly imageQueue: Queue<ImageProcessingPayload>,
    @InjectQueue(CSV_NAME) private readonly csvQueue: Queue<CsvImportPayload>,
    private readonly prisma: PrismaService,
  ) { }

  async createImageJob(payload: ImageProcessingPayload) {
    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: IMAGE_JOB_NAME,
        queue_name: IMAGE_NAME,
        status: 'queued',
        payload: payload as any,
      },
    });

    try {
      // 2. Add job to BullMQ Redis Queue
      // We pass the Postgres Job ID as the BullMQ Job ID so they map 1:1
      const bullJob = await this.imageQueue.add(IMAGE_JOB_NAME, payload, {
        jobId: dbJob.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        message: 'Image Job created successfully',
        jobId: dbJob.id,
      };
    } catch (error) {
      // If Redis fails, update DB status to failed
      await this.prisma.job.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to enqueue Image job',
        },
      });
      throw new InternalServerErrorException('Failed to enqueue Image job');
    }
  }

  async createCsvJob(payload: CsvImportPayload) {
    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: CSV_JOB_NAME,
        queue_name: CSV_NAME,
        status: 'queued',
        payload: payload as any,
      },
    });

    try {
      // 2. Add job to BullMQ Redis Queue
      // We pass the Postgres Job ID as the BullMQ Job ID so they map 1:1
      const bullJob = await this.csvQueue.add(CSV_JOB_NAME, payload, {
        jobId: dbJob.id,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      return {
        message: 'Csv Job created successfully',
        jobId: dbJob.id,
      };
    } catch (error) {
      // If Redis fails, update DB status to failed
      await this.prisma.job.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Failed to enqueue Csv job',
        },
      });
      throw new InternalServerErrorException('Failed to enqueue Csv job');
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
