import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import * as os from 'os';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workerId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit() {
    this.logger.log('Initializing worker heartbeat...');

    // Register the worker in the database
    const worker = await this.prisma.worker.create({
      data: {
        hostname: os.hostname(),
        status: 'active',
      },
    });

    this.workerId = worker.id;
    this.logger.log(`Worker registered with ID: ${this.workerId}`);

    // Start heartbeat loop every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (!this.workerId) return;
      try {
        await this.prisma.worker.update({
          where: { id: this.workerId },
          data: { last_heartbeat: new Date() },
        });
        this.logger.debug(`Heartbeat sent for worker ${this.workerId}`);
      } catch (error) {
        this.logger.error(`Failed to send heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 30000);
  }

  async onModuleDestroy() {
    this.logger.log('Worker shutting down. Cleaning up...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.workerId) {
      try {
        await this.prisma.worker.update({
          where: { id: this.workerId },
          data: { status: 'offline', last_heartbeat: new Date() },
        });
        this.logger.log(`Worker ${this.workerId} marked as offline`);
      } catch (error) {
        this.logger.error(`Failed to mark worker offline: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
}
