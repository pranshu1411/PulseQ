import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@app/prisma';
import { IMAGE_NAME, CSV_NAME } from '@app/shared';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { ProductsController } from './products.controller';
import { ImagesController } from './images.controller';
import { StorageModule } from '@app/shared';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 20,
    }]),
    StorageModule,
    PrometheusModule.register(),
    AuthModule,
    EventsModule,
    PrismaModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: IMAGE_NAME,
    }, {
      name: CSV_NAME
    }),
  ],
  controllers: [AppController, ProductsController, ImagesController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    makeCounterProvider({
      name: 'pulseq_jobs_added_total',
      help: 'Total number of jobs added to the queue',
      labelNames: ['queue_name'],
    }),
  ],
})
export class AppModule { }
