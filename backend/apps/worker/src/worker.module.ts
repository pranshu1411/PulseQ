import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@app/prisma';
import { ImageProcessor } from './image.processor';
import { CsvProcessor } from './csv.processor';
import { IMAGE_NAME, CSV_NAME } from '@app/shared';

@Module({
  imports: [
    PrometheusModule.register(),
    PrismaModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: 6379,
      },
    }),
    BullModule.registerQueue(
      { name: IMAGE_NAME },
      { name: CSV_NAME }
    ),
  ],
  controllers: [WorkerController],
  providers: [
    WorkerService, 
    ImageProcessor, 
    CsvProcessor,
    makeCounterProvider({
      name: 'pulseq_jobs_completed_total',
      help: 'Total number of completed jobs',
      labelNames: ['queue_name'],
    }),
    makeCounterProvider({
      name: 'pulseq_jobs_failed_total',
      help: 'Total number of failed jobs',
      labelNames: ['queue_name'],
    }),
  ],
})
export class WorkerModule {}
