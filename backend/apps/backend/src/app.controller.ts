import { Controller, Get, Post, Body, Param, Req, UseGuards, Res, Query } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';
import { ImageProcessingPayload, CsvImportPayload } from '@app/shared';
import { AuthGuard } from '@nestjs/passport';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Post('image')
  async createImageJob(@Body() payload: ImageProcessingPayload, @Req() req: any) {
    return this.appService.createImageJob(payload, req.user.id);
  }

  @Post('csv')
  async createCsvJob(@Body() payload: CsvImportPayload, @Req() req: any) {
    return this.appService.createCsvJob(payload, req.user.id);
  }

  @Get(':id')
  async getJobById(@Param('id') jobId: string, @Req() req: any) {
    return this.appService.getJobById(jobId, req.user.id);
  }

  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string, @Req() req: any) {
    return this.appService.retryJob(jobId, req.user.id);
  }

  @Get()
  async getAllJobs(@Req() req: any) {
    return this.appService.getAllJobs(req.user.id);
  }

  @Get(':id/download/:type')
  async downloadJobFile(
    @Param('id') jobId: string,
    @Param('type') type: 'thumbnail' | 'compressed',
    @Req() req: any,
    @Res() res: Response,
  ) {
    return this.appService.downloadJobFile(jobId, type, req.user.id, res);
  }
}
