import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '@app/prisma';
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
    BullModule.registerQueue({
      name: IMAGE_NAME,
    }, {
      name: CSV_NAME
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
