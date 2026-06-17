import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { type JobPayload } from '@app/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('jobs')
  async createJob(@Body() payload: JobPayload) {
    return this.appService.createJob(payload);
  }
}
