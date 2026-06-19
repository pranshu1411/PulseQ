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
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
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
        select: { userId: true },
      });
      if (job) {
        this.logger.log(`Emitting ${eventName} to user:${job.userId} for job ${jobId}`);
        this.server.to(`user:${job.userId}`).emit(eventName, data);
      } else {
        this.logger.warn(`Job ${jobId} not found in DB, cannot emit ${eventName}`);
      }
    } catch (e) {
      this.logger.error(`Error emitting to user for job ${jobId}:`, e.message);
    }
  }

  private setupListeners(queueEvents: QueueEvents, queueName: string) {
    queueEvents.on('active', ({ jobId, prev }) => {
      this.emitToUser(jobId, 'jobActive', { queueName, jobId, prev });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.emitToUser(jobId, 'jobCompleted', { queueName, jobId, returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.emitToUser(jobId, 'jobFailed', { queueName, jobId, failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      this.emitToUser(jobId, 'jobProgress', { queueName, jobId, data });
    });

    queueEvents.on('waiting', ({ jobId }) => {
      this.emitToUser(jobId, 'jobWaiting', { queueName, jobId });
    });
  }

  handleConnection(client: Socket) {
    try {
      const cookies = client.handshake.headers.cookie;
      if (!cookies) throw new Error('No cookies found');
      
      const token = cookies.split(';').find(c => c.trim().startsWith('Authentication='))?.split('=')[1];
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
