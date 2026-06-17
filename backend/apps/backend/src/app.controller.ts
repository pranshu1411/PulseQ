import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { type JobPayload } from '@app/shared';

@Controller('jobs')
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Post()
  async createJob(@Body() payload: JobPayload) {
    return this.appService.createJob(payload);
  }

  @Get(':id')
  async getJobById(@Param('id') jobId: string) {
    return this.appService.getJobById(jobId);
  }

  @Get()
  async getAllJobs() {
    return this.appService.getAllJobs();
  }
}
