import { Controller, Get, Post, Body, Param, Req, UseGuards, Res, Query, UseInterceptors, UploadedFiles, StreamableFile } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response, Express } from 'express';
import { AppService } from './app.service';
import { ImageProcessingPayload, CsvImportPayload, StorageService } from '@app/shared';
import type { AuthenticatedRequest } from '@app/shared';
import { AuthGuard } from '@nestjs/passport';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly storageService: StorageService,
  ) { }

  @Post('image')
  async createImageJob(@Body() payload: ImageProcessingPayload, @Req() req: AuthenticatedRequest) {
    return this.appService.createImageJob(payload, req.user.id);
  }

  @Post('csv')
  async createCsvJob(@Body() payload: CsvImportPayload, @Req() req: AuthenticatedRequest) {
    return this.appService.createCsvJob(payload, req.user.id);
  }

  @Post('upload/image')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB
    },
  }))
  async uploadImageJobFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    const urls = await Promise.all(
      files.map(async (f) => {
        const fileHash = require('crypto').createHash('sha256').update(f.buffer).digest('hex').substring(0, 32);
        const filename = `${fileHash}-${f.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
        await this.storageService.uploadBuffer(f.buffer, filename, f.mimetype);
        return filename;
      })
    );
    return { urls };
  }

  @Post('upload/csv')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB
    },
  }))
  async uploadCsvJobFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    const urls = await Promise.all(
      files.map(async (f) => {
        const fileHash = require('crypto').createHash('sha256').update(f.buffer).digest('hex').substring(0, 32);
        const filename = `${fileHash}-${f.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
        await this.storageService.uploadBuffer(f.buffer, filename, f.mimetype);
        return filename;
      })
    );
    return { urls };
  }

  @Get('stats')
  async getJobStats(@Req() req: AuthenticatedRequest) {
    return this.appService.getJobStats(req.user.id);
  }

  @Get('analytics/workers')
  async getWorkers() {
    return this.appService.getWorkers();
  }

  @Get('analytics/worker-metrics')
  async getWorkerMetrics() {
    return this.appService.getWorkerMetrics();
  }

  @Get('analytics/throughput')
  async getThroughput(@Req() req: AuthenticatedRequest) {
    return this.appService.getThroughput(req.user.id);
  }

  @Get('analytics/latency')
  async getLatencyStats(@Req() req: AuthenticatedRequest) {
    return this.appService.getLatencyStats(req.user.id);
  }

  @Get('analytics/failures')
  async getFailureAnalytics(@Req() req: AuthenticatedRequest) {
    return this.appService.getFailureAnalytics(req.user.id);
  }

  @Get('analytics/retries')
  async getRetryStats(@Req() req: AuthenticatedRequest) {
    return this.appService.getRetryStats(req.user.id);
  }

  @Get(':id')
  async getJobById(@Param('id') jobId: string, @Req() req: AuthenticatedRequest) {
    return this.appService.getJobById(jobId, req.user.id);
  }

  @Get(':id/logs')
  async getJobLogs(
    @Param('id') jobId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Req() req: AuthenticatedRequest
  ) {
    return this.appService.getJobLogs(jobId, parseInt(page, 10), parseInt(limit, 10), req.user.id);
  }

  @Post(':id/retry')
  async retryJob(@Param('id') jobId: string, @Req() req: AuthenticatedRequest) {
    return this.appService.retryJob(jobId, req.user.id);
  }

  @Get()
  async getAllJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: AuthenticatedRequest
  ) {
    return this.appService.getAllJobs(parseInt(page, 10), parseInt(limit, 10), req.user.id);
  }

  @Get(':id/download/:type')
  async downloadJobFile(
    @Param('id') jobId: string,
    @Param('type') type: 'thumbnail' | 'compressed',
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, filename } = await this.appService.downloadJobFile(jobId, type, req.user.id);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(stream);
  }
}
