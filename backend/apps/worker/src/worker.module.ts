import { Module } from '@nestjs/common';
import { WorkerController } from './worker.controller';
import { WorkerService } from './worker.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@app/prisma';
import { ImageProcessor } from './image.processor';
import { CsvProcessor } from './csv.processor';
import { IMAGE_NAME, CSV_NAME } from '@app/shared';

@Module({
  imports: [
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
  providers: [WorkerService, ImageProcessor, CsvProcessor],
})
export class WorkerModule {}
