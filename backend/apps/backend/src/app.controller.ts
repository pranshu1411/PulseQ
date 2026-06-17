import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { type ImageProcessingPayload, type CsvImportPayload } from '@app/shared';

@Controller('jobs')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Post('image')
  async createImageJob(@Body() payload: ImageProcessingPayload) {
    return this.appService.createImageJob(payload);
  }

  @Post('csv')
  async createCsvJob(@Body() payload: CsvImportPayload) {
    return this.appService.createCsvJob(payload);
  }

  @Get(':id')
  async getJobById(@Param('id') jobId: string) {
    return this.appService.getJobById(jobId);
  }

  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string) {
    return this.appService.retryJob(jobId);
  }

  @Get()
  async getAllJobs() {
    return this.appService.getAllJobs();
  }
}
