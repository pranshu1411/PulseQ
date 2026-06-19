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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(EventsGateway.name);

  private imageQueueEvents: QueueEvents;
  private csvQueueEvents: QueueEvents;

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

  private setupListeners(queueEvents: QueueEvents, queueName: string) {
    queueEvents.on('active', ({ jobId, prev }) => {
      this.server.emit('jobActive', { queueName, jobId, prev });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.server.emit('jobCompleted', { queueName, jobId, returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.server.emit('jobFailed', { queueName, jobId, failedReason });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      this.server.emit('jobProgress', { queueName, jobId, data });
    });

    queueEvents.on('waiting', ({ jobId }) => {
      this.server.emit('jobWaiting', { queueName, jobId });
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
