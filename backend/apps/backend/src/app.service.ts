import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '@app/prisma';
import { IMAGE_NAME, ImageProcessingPayload, CSV_NAME, CsvImportPayload, IMAGE_JOB_NAME, CSV_JOB_NAME, StorageService } from '@app/shared';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { EventsGateway } from './events/events.gateway';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private staleJobChecker: ReturnType<typeof setInterval> | null = null;

  // Jobs queued for longer than this (ms) without being picked up are marked failed
  private readonly STALE_JOB_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  private readonly STALE_CHECK_INTERVAL_MS = 30 * 1000; // check every 30s
  constructor(
    @InjectQueue(IMAGE_NAME) private readonly imageQueue: Queue<ImageProcessingPayload>,
    @InjectQueue(CSV_NAME) private readonly csvQueue: Queue<CsvImportPayload>,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    @InjectMetric('pulseq_jobs_added_total') private readonly jobsAddedCounter: Counter<string>,
    private readonly eventsGateway: EventsGateway,
  ) { }

  onModuleInit() {
    this.staleJobChecker = setInterval(() => this.markStaleJobsAsFailed(), this.STALE_CHECK_INTERVAL_MS);
    this.logger.log(`Stale job checker started (interval: ${this.STALE_CHECK_INTERVAL_MS / 1000}s, timeout: ${this.STALE_JOB_TIMEOUT_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.staleJobChecker) {
      clearInterval(this.staleJobChecker);
      this.staleJobChecker = null;
    }
  }

  private generateDedupHash(payload: any): string {
    const sortedPayload = Object.keys(payload).sort().reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {} as any);
    return crypto.createHash('sha256').update(JSON.stringify(sortedPayload)).digest('hex');
  }

  private async markStaleJobsAsFailed() {
    try {
      const cutoff = new Date(Date.now() - this.STALE_JOB_TIMEOUT_MS);

      // 1. Reconcile queued jobs that timed out
      const staleJobs = await this.prisma.job.findMany({
        where: {
          status: 'queued',
          created_at: { lt: cutoff },
        },
      });

      for (const job of staleJobs) {
        const failedReason = 'Job timed out waiting for a worker. No worker picked up this job within the allowed time.';
        await this.prisma.$transaction([
          this.prisma.job.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              error: { message: failedReason },
            },
          }),
          this.prisma.jobLog.create({
            data: {
              job_id: job.id,
              event_type: 'failed',
              message: `Job timed out after ${this.STALE_JOB_TIMEOUT_MS / 1000}s in queued state — no worker available`,
            },
          }),
        ]);

        const queue = job.queue_name === IMAGE_NAME ? this.imageQueue : this.csvQueue;
        const bullJob = await queue.getJob(job.id);
        if (bullJob) {
          await bullJob.remove();
        }

        await this.eventsGateway.emitJobFailedToUser(job.id, job.queue_name, failedReason);
        this.logger.warn(`Marked stale job ${job.id} (${job.name}) as failed — queued since ${job.created_at.toISOString()}`);
      }

      // 2. Reconcile active jobs that might have been interrupted during worker shutdown
      const activeJobs = await this.prisma.job.findMany({
        where: {
          status: 'active',
          updated_at: { lt: new Date(Date.now() - 60000) } // Hasn't been updated in 1 minute
        },
      });

      for (const job of activeJobs) {
        const queue = job.queue_name === IMAGE_NAME ? this.imageQueue : this.csvQueue;
        const bullJob = await queue.getJob(job.id);
        
        if (!bullJob) {
          // Job is missing from BullMQ. Since removeOnComplete/removeOnFail deleted it, 
          // or it was lost, we mark it as failed to prevent it from being stuck forever.
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: 'failed', error: { message: 'Job was lost or worker shut down unexpectedly without saving status' } },
          });
          this.logger.log(`Reconciled missing active job ${job.id} to failed`);
          continue;
        }

        const state = await bullJob.getState();
        if (state === 'completed') {
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: 'completed', completed_at: new Date() },
          });
          this.logger.log(`Reconciled stuck active job ${job.id} to completed`);
        } else if (state === 'failed') {
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: 'failed' },
          });
          this.logger.log(`Reconciled stuck active job ${job.id} to failed`);
        } else if (state === 'waiting' || state === 'delayed') {
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: 'queued' },
          });
          this.logger.log(`Reconciled stuck active job ${job.id} back to queued`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to check for stale/active jobs:', error);
    }
  }

  async createImageJob(payload: ImageProcessingPayload, userId: string) {
    const recentJobs = await this.prisma.job.findMany({
      where: {
        userId,
        queue_name: IMAGE_NAME,
        status: { in: ['queued', 'active'] },
      },
    });

    const payloadHash = this.generateDedupHash(payload);
    const duplicate = recentJobs.find(j => this.generateDedupHash(j.payload) === payloadHash);

    if (duplicate) {
      this.logger.log(`Skipped duplicate Image Job request. Returning existing Job ID: ${duplicate.id}`);
      return {
        message: 'A duplicate Image Job is already queued or processing.',
        jobId: duplicate.id,
      };
    }

    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: payload.jobName || IMAGE_JOB_NAME,
        queue_name: IMAGE_NAME,
        status: 'queued',
        priority: payload.priority || 5,
        payload: payload as unknown as any, // Cast to any internally if needed, but the interface handles JSON. Actually, let's just cast to any for Prisma to accept it. Oh wait, if payload is not pure JSON, let's pass JSON.parse(JSON.stringify(payload)).
        userId,
      },
    });

    try {
      // 2. Add job to BullMQ Redis Queue
      // We pass the Postgres Job ID as the BullMQ Job ID so they map 1:1
      const bullJob = await this.imageQueue.add(IMAGE_JOB_NAME, payload, {
        jobId: dbJob.id,
        priority: payload.priority || 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 3600, count: 1000 },
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
          error: error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : { message: 'Failed to enqueue Image job', raw: error },
        },
      });
      throw new InternalServerErrorException('Failed to enqueue Image job');
    }
  }

  async createCsvJob(payload: CsvImportPayload, userId: string) {
    const recentJobs = await this.prisma.job.findMany({
      where: {
        userId,
        queue_name: CSV_NAME,
        status: { in: ['queued', 'active'] },
      },
    });

    const payloadHash = this.generateDedupHash(payload);
    const duplicate = recentJobs.find(j => this.generateDedupHash(j.payload) === payloadHash);

    if (duplicate) {
      this.logger.log(`Skipped duplicate CSV Job request. Returning existing Job ID: ${duplicate.id}`);
      return {
        message: 'A duplicate Csv Job is already queued or processing.',
        jobId: duplicate.id,
      };
    }

    // 1. Create a job record in Postgres via Prisma
    const dbJob = await this.prisma.job.create({
      data: {
        name: payload.jobName || CSV_JOB_NAME,
        queue_name: CSV_NAME,
        status: 'queued',
        priority: payload.priority || 5,
        payload: payload as unknown as any,
        userId,
      },
    });

    try {
      // 2. Add job to BullMQ Redis Queue
      // We pass the Postgres Job ID as the BullMQ Job ID so they map 1:1
      const bullJob = await this.csvQueue.add(CSV_JOB_NAME, payload, {
        jobId: dbJob.id,
        priority: payload.priority || 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 3600, count: 1000 },
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
          error: error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : { message: 'Failed to enqueue Csv job', raw: error },
        },
      });
      throw new InternalServerErrorException('Failed to enqueue Csv job');
    }
  }

  async getJobById(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { logs: { orderBy: { created_at: 'desc' } } },
    });

    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }

    return job;
  }

  async getJobLogs(jobId: string, page: number, limit: number, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });

    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job not found`);
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.jobLog.findMany({
        where: { job_id: jobId },
        orderBy: { created_at: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.jobLog.count({ where: { job_id: jobId } })
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
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
    let bullJob = await queue.getJob(jobId);

    if (!bullJob) {
      // Job was purged or removed by our stale job checker. Re-enqueue it.
      bullJob = await queue.add(dbJob.name, dbJob.payload as any, {
        jobId: dbJob.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: true,
      });
    } else {
      // 3. Trigger BullMQ retry
      // This moves the job from the 'failed' set back to the 'wait' set
      await bullJob.retry();
    }

    // 4. Update the DB to reflect the manual intervention
    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'queued',
          error: Prisma.DbNull, // Clear the previous error
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

  async getAllJobs(page: number, limit: number, status: string | undefined, userId: string) {
    const skip = (page - 1) * limit;
    
    const whereClause: any = { userId };
    if (status) {
      whereClause.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
      }),
      this.prisma.job.count({ where: whereClause }),
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
      else if (stat.status === 'failed' || stat.status === 'purged') result.failed += stat._count;
      else result.waiting += stat._count;
    }
    return result;
  }

  async retryAllFailedJobs(userId: string) {
    const failedJobs = await this.prisma.job.findMany({ where: { userId, status: 'failed' } });
    let count = 0;
    for (const job of failedJobs) {
      try {
        await this.retryJob(job.id, userId);
        count++;
      } catch (e) {
        this.logger.error(`Failed to retry job ${job.id}`, e);
      }
    }
    return { message: `Successfully requeued ${count} failed jobs.` };
  }

  async purgeAllFailedJobs(userId: string) {
    const res = await this.prisma.job.updateMany({ 
      where: { userId, status: 'failed' },
      data: { status: 'purged' }
    });
    return { message: `Successfully purged ${res.count} permanently failed jobs.` };
  }

  async deleteFailedJob(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) {
      throw new NotFoundException(`Job with ID ${jobId} not found`);
    }
    if (job.status !== 'failed') {
      throw new BadRequestException(`Only failed jobs can be deleted. Current status is ${job.status}`);
    }
    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'purged' },
    });
    return { message: `Job ${jobId} successfully purged.` };
  }

  async downloadJobFile(jobId: string, type: 'thumbnail' | 'compressed', userId: string) {
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

    const s3Key = type === 'thumbnail' ? result.thumbnailPath : result.compressedPath;
    if (!s3Key) {
      throw new NotFoundException(`File path not found in job result`);
    }

    const stream = await this.storageService.getFileStream(s3Key);
    const filename = path.basename(s3Key);

    return { stream, filename };
  }

  async getWorkers() {
    // 1. Cleanup: delete workers that haven't sent a heartbeat in 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.worker.deleteMany({
      where: { last_heartbeat: { lt: oneDayAgo } }
    });

    // 2. Fetch workers active within the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const cutoff = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
    const workers = await this.prisma.worker.findMany({
      where: { last_heartbeat: { gte: twoHoursAgo } },
      orderBy: { last_heartbeat: 'desc' }
    });

    return workers.map(w => ({
      ...w,
      status: w.last_heartbeat < cutoff ? 'offline' : w.status
    }));
  }

  async getWorkerMetrics() {
    // 1. Cleanup metrics older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.workerMetric.deleteMany({
      where: { timestamp: { lt: oneDayAgo } }
    });

    // 2. Fetch metrics for the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const metrics = await this.prisma.workerMetric.findMany({
      where: { timestamp: { gte: oneHourAgo } },
      include: { worker: { select: { hostname: true } } },
      orderBy: { timestamp: 'asc' }
    });

    // 3. Group by 30-second buckets for the LineChart
    const formatted: Record<string, any> = {};
    for (const m of metrics) {
      const d = new Date(m.timestamp);
      const coeff = 1000 * 30;
      const rounded = new Date(Math.floor(d.getTime() / coeff) * coeff);
      const iso = rounded.toISOString();

      if (!formatted[iso]) {
        formatted[iso] = { timestamp: iso };
      }
      formatted[iso][`${m.worker.hostname}_cpu`] = Math.round(m.cpu * 100) / 100;
      formatted[iso][`${m.worker.hostname}_memory`] = Math.round(m.memory);
    }

    return Object.values(formatted);
  }

  async getThroughput(userId: string) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const logs = await this.prisma.jobLog.findMany({
      where: {
        created_at: { gte: oneHourAgo },
        event_type: { in: ['completed', 'failed'] },
        job: { userId }
      },
      select: { event_type: true, created_at: true },
      orderBy: { created_at: 'asc' }
    });

    const buckets: Record<string, { timestamp: string, completed: number, failed: number }> = {};
    for (let i = 0; i <= 60; i++) {
      const d = new Date(oneHourAgo.getTime() + i * 60 * 1000);
      d.setSeconds(0, 0);
      buckets[d.toISOString()] = { timestamp: d.toISOString(), completed: 0, failed: 0 };
    }

    for (const log of logs) {
      const d = new Date(log.created_at);
      d.setSeconds(0, 0);
      const iso = d.toISOString();
      if (buckets[iso]) {
        if (log.event_type === 'completed') buckets[iso].completed++;
        else if (log.event_type === 'failed') buckets[iso].failed++;
      }
    }
    return Object.values(buckets);
  }

  async getLatencyStats(userId: string) {
    const recentJobs = await this.prisma.job.findMany({
      where: { userId, status: 'completed', completed_at: { not: null } },
      include: { logs: true },
      take: 100,
      orderBy: { completed_at: 'desc' }
    });

    let totalWaitMs = 0;
    let totalProcessMs = 0;
    let validWaitCount = 0;
    let validProcessCount = 0;

    for (const job of recentJobs) {
      const startedLog = job.logs.find(l => l.event_type === 'active' || l.event_type === 'started');
      const createdTime = job.created_at.getTime();
      const completedTime = job.completed_at!.getTime();

      if (startedLog) {
        const startedTime = startedLog.created_at.getTime();
        totalWaitMs += (startedTime - createdTime);
        totalProcessMs += (completedTime - startedTime);
        validWaitCount++;
        validProcessCount++;
      } else {
        totalProcessMs += (completedTime - createdTime);
        validProcessCount++;
      }
    }

    return {
      averageWaitTimeMs: validWaitCount > 0 ? Math.round(totalWaitMs / validWaitCount) : 0,
      averageProcessingTimeMs: validProcessCount > 0 ? Math.round(totalProcessMs / validProcessCount) : 0
    };
  }

  async getFailureAnalytics(userId: string) {
    const failedJobs = await this.prisma.job.findMany({
      where: { userId, status: { in: ['failed', 'purged'] } },
      take: 100,
      orderBy: { updated_at: 'desc' },
      select: { error: true }
    });

    const counts: Record<string, number> = {};
    for (const job of failedJobs) {
      const err = job.error as any;
      const msg = err?.message || 'Unknown error';
      counts[msg] = (counts[msg] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getRetryStats(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { userId },
      select: { attempts: true },
    });

    let retriedJobs = 0;
    for (const job of jobs) {
      if (job.attempts > 1) retriedJobs++;
    }

    return {
      retriedJobs,
      totalJobs: jobs.length,
      retryRate: jobs.length > 0 ? (retriedJobs / jobs.length) : 0
    };
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
