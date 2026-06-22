import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { QueueEvents } from 'bullmq';
import { IMAGE_NAME, CSV_NAME } from '@app/shared';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@app/prisma';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class EventsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  private imageQueueEvents: QueueEvents;
  private csvQueueEvents: QueueEvents;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');

    const connection = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: 6379,
    };

    this.imageQueueEvents = new QueueEvents(IMAGE_NAME, { connection });
    this.csvQueueEvents = new QueueEvents(CSV_NAME, { connection });

    this.setupListeners(this.imageQueueEvents, IMAGE_NAME);
    this.setupListeners(this.csvQueueEvents, CSV_NAME);
  }

  private async emitToUser(jobId: string, eventName: string, data: any) {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
        select: { userId: true, name: true, priority: true },
      });
      if (job) {
        this.logger.log(
          `Emitting ${eventName} to user:${job.userId} for job ${jobId}`,
        );
        this.server.to(`user:${job.userId}`).emit(eventName, {
          ...data,
          jobName: job.name,
          priority: job.priority,
        });
      } else {
        this.logger.warn(
          `Job ${jobId} not found in DB, cannot emit ${eventName}`,
        );
      }
    } catch (e) {
      this.logger.error(`Error emitting to user for job ${jobId}:`, e.message);
    }
  }

  public async emitJobFailedToUser(
    jobId: string,
    queueName: string,
    failedReason: string,
  ) {
    await this.emitToUser(jobId, 'jobFailed', {
      queueName,
      jobId,
      failedReason,
    });
  }

  private setupListeners(queueEvents: QueueEvents, queueName: string) {
    queueEvents.on('active', async ({ jobId, prev }) => {
      // Detect retries: if the job has prior attempts, it's a retry cycle.
      // We don't need to wait here — the initial active has attempts=0 in DB,
      // retry actives have attempts>0 (set by BaseProcessor.onFailed).
      const dbJob = await this.prisma.job
        .findUnique({ where: { id: jobId }, select: { attempts: true } })
        .catch(() => null);
      const isRetry = dbJob != null && dbJob.attempts > 0;
      this.emitToUser(jobId, 'jobActive', { queueName, jobId, prev, isRetry });
    });

    queueEvents.on('delayed', async ({ jobId, delay }) => {
      // Wait for BaseProcessor.onFailed to write to DB first.
      await new Promise((r) => setTimeout(r, 150));
      const dbJob = await this.prisma.job
        .findUnique({ where: { id: jobId }, select: { attempts: true, status: true } })
        .catch(() => null);
      const isRetry = dbJob != null && dbJob.attempts > 0;
      const isUserScheduled = dbJob?.status === 'delayed';
      // Suppress spurious BullMQ 'delayed' events fired for non-delayed, non-retry jobs
      // (BullMQ occasionally fires this for priority queue jobs on initial add).
      if (!isUserScheduled && !isRetry) return;
      this.emitToUser(jobId, 'jobDelayed', { queueName, jobId, delay, isRetry });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.emitToUser(jobId, 'jobCompleted', { queueName, jobId, returnvalue });
    });

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      // Wait briefly for BaseProcessor.onFailed to write the status to DB.
      await new Promise((r) => setTimeout(r, 150));
      const dbJob = await this.prisma.job
        .findUnique({ where: { id: jobId }, select: { status: true } })
        .catch(() => null);
      // If status is 'failed' it's a permanent failure. If 'delayed', BullMQ is retrying.
      const isPermanent = !dbJob || dbJob.status === 'failed';
      this.emitToUser(jobId, 'jobFailed', { queueName, jobId, failedReason, isPermanent });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      this.emitToUser(jobId, 'jobProgress', { queueName, jobId, data });
    });

    queueEvents.on('waiting', async ({ jobId }) => {
      // Detect if this 'waiting' is a retry re-queue or a fresh job entering the queue.
      const dbJob = await this.prisma.job
        .findUnique({ where: { id: jobId }, select: { attempts: true } })
        .catch(() => null);
      const isRetry = dbJob != null && dbJob.attempts > 0;

      if (!isRetry) {
        // Only update status to 'queued' for non-retry waits
        try {
          await this.prisma.job.update({
            where: { id: jobId },
            data: { status: 'queued' },
          });
        } catch (e) {
          this.logger.error(
            `Failed to update status to queued for waiting job ${jobId}`,
            e,
          );
        }
      }
      this.emitToUser(jobId, 'jobWaiting', { queueName, jobId, isRetry });
    });
  }

  handleConnection(client: Socket) {
    try {
      const cookies = client.handshake.headers.cookie;
      if (!cookies) throw new Error('No cookies found');

      const token = cookies
        .split(';')
        .find((c) => c.trim().startsWith('Authentication='))
        ?.split('=')[1];
      if (!token) throw new Error('Authentication cookie not found');

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} joined room user:${userId}`);
    } catch (e) {
      this.logger.error(`Unauthorized socket connection: ${e.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  async onModuleDestroy() {
    this.logger.log('Closing QueueEvents connections...');
    if (this.imageQueueEvents) {
      await this.imageQueueEvents.close();
    }
    if (this.csvQueueEvents) {
      await this.csvQueueEvents.close();
    }
  }
}
