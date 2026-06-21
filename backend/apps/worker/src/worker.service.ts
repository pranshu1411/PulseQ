import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@app/prisma';
import * as os from 'os';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workerId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastCpus: os.CpuInfo[] | null = null;

  constructor(private readonly prisma: PrismaService) { }

  async onModuleInit() {
    this.logger.log('Initializing worker heartbeat...');

    // Register the worker in the database
    const worker = await this.prisma.worker.create({
      data: {
        hostname: `${os.hostname()}-${process.pid}`,
        status: 'active',
      },
    });

    this.workerId = worker.id;
    this.logger.log(`Worker registered with ID: ${this.workerId}`);

    // Start heartbeat loop every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (!this.workerId) return;
      try {
        const currentCpus = os.cpus();
        let cpuUsage = 0;

        if (this.lastCpus) {
          let totalIdle = 0;
          let totalTick = 0;

          for (let i = 0; i < currentCpus.length; i++) {
            const cpu = currentCpus[i];
            const prevCpu = this.lastCpus[i];

            for (const type in cpu.times) {
              totalTick += cpu.times[type as keyof typeof cpu.times] - prevCpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle - prevCpu.times.idle;
          }

          if (totalTick > 0) {
            cpuUsage = (1 - totalIdle / totalTick) * 100;
          }
        } else {
          // On first tick, we don't have a delta, so we use loadavg if available (non-Windows) or default to 0
          const load = os.loadavg()[0];
          cpuUsage = os.platform() === 'win32' ? 0 : Math.min((load / currentCpus.length) * 100, 100);
        }
        
        this.lastCpus = currentCpus;
        const memoryUsage = process.memoryUsage().rss / 1024 / 1024; // in MB

        await this.prisma.$transaction([
          this.prisma.worker.update({
            where: { id: this.workerId },
            data: { last_heartbeat: new Date() },
          }),
          this.prisma.workerMetric.create({
            data: {
              workerId: this.workerId,
              cpu: cpuUsage,
              memory: memoryUsage,
            },
          }),
        ]);
        this.logger.debug(`Heartbeat & metrics sent for worker ${this.workerId}`);
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
