import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { IMAGE_NAME, ImageProcessingPayload, CSV_NAME, CsvImportPayload, IMAGE_JOB_NAME, CSV_JOB_NAME } from '@app/shared';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class AppService {
  constructor(
    @InjectQueue(IMAGE_NAME) private readonly imageQueue: Queue<ImageProcessingPayload>,
    @InjectQueue(CSV_NAME) private readonly csvQueue: Queue<CsvImportPayload>,
    private readonly prisma: PrismaService,
    @InjectMetric('pulseq_jobs_added_total') private readonly jobsAddedCounter: Counter<string>,
  ) { }

  async createImageJob(payload: ImageProcessingPayload, userId: string) {
    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: payload.jobName || IMAGE_JOB_NAME,
        queue_name: IMAGE_NAME,
        status: 'queued',
        payload: payload as any,
        userId,
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
        removeOnComplete: true,
        removeOnFail: true,
      });

      this.jobsAddedCounter.labels(IMAGE_NAME).inc();

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

  async createCsvJob(payload: CsvImportPayload, userId: string) {
    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: payload.jobName || CSV_JOB_NAME,
        queue_name: CSV_NAME,
        status: 'queued',
        payload: payload as any,
        userId,
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
        removeOnComplete: true,
        removeOnFail: true,
      });

      this.jobsAddedCounter.labels(CSV_NAME).inc();

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

  async getJobById(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { logs: { orderBy: { created_at: 'asc' } } }
    });

    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return job;
  }

  async retryJob(jobId: string, userId: string) {
    const dbJob = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!dbJob || dbJob.userId !== userId) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    if (dbJob.status !== 'failed') {
      throw new BadRequestException(`Only failed jobs can be retried. Current status is ${dbJob.status}`);
    }

    // 1. Determine which queue this job belongs to
    const queue = dbJob.queue_name === IMAGE_NAME ? this.imageQueue : this.csvQueue;

    // 2. Fetch the job from Redis
    const bullJob = await queue.getJob(jobId);

    if (!bullJob) {
      throw new NotFoundException(`BullMQ Job ${jobId} not found in Redis. It may have been purged.`);
    }

    // 3. Trigger BullMQ retry
    // This moves the job from the 'failed' set back to the 'wait' set
    await bullJob.retry();

    // 4. Update the DB to reflect the manual intervention
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'queued',
          error: null, // Clear the previous error
          updated_at: new Date(), // We update this manually here since it's a specific user action
        },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: jobId,
          event_type: 'retried',
          message: 'Job was manually retried via API',
        },
      }),
    ]);

    return { message: `Job ${jobId} has been requeued for processing.` };
  }

  async getAllJobs(page: number, limit: number, userId: string) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.job.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobStats(userId: string) {
    const stats = await this.prisma.job.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const result = { active: 0, completed: 0, failed: 0, waiting: 0 };
    for (const stat of stats) {
      if (stat.status === 'active') result.active += stat._count;
      else if (stat.status === 'completed') result.completed += stat._count;
      else if (stat.status === 'failed') result.failed += stat._count;
      else result.waiting += stat._count;
    }
    return result;
  }

  async downloadJobFile(jobId: string, type: 'thumbnail' | 'compressed', userId: string, res: Response) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job not found`);
    }

    if (job.queue_name !== IMAGE_NAME) {
      throw new BadRequestException(`Only image jobs produce downloadable files`);
    }

    if (job.status !== 'completed') {
      throw new BadRequestException(`Job is not completed yet`);
    }

    const result = job.result as any;
    if (!result) {
      throw new NotFoundException(`Job result not found`);
    }

    const relativePath = type === 'thumbnail' ? result.thumbnailPath : result.compressedPath;
    if (!relativePath) {
      throw new NotFoundException(`File path not found in job result`);
    }

    const absolutePath = path.join(process.cwd(), relativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(`File no longer exists on disk`);
    }

    res.download(absolutePath);
  }

  async getProducts(page: number, limit: number, search?: string, userId?: string) {
    const skip = (page - 1) * limit;

    const whereClause: any = { userId };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { category: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      this.prisma.product.count({
        where: whereClause,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getImages(page: number, limit: number, userId?: string) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.imageRecord.findMany({
        where: { userId },
        include: { job: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.imageRecord.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
