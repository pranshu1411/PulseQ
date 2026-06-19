import { Controller, Get, Post, Body, Param, Req, UseGuards, Res, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import type { Response, Express } from 'express';
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

  @Post('upload/image')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const path = './public/uploads/jobs';
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`);
      },
    }),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20 MB
    },
  }))
  async uploadImageJobFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    return { urls: files.map(f => `http://localhost:4000/uploads/jobs/${f.filename}`) };
  }

  @Post('upload/csv')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const path = './public/uploads/jobs';
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        cb(null, path);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`);
      },
    }),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100 MB
    },
  }))
  async uploadCsvJobFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
    return { urls: files.map(f => `http://localhost:4000/uploads/jobs/${f.filename}`) };
  }

  @Get('stats')
  async getJobStats(@Req() req: any) {
    return this.appService.getJobStats(req.user.id);
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
  async getAllJobs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Req() req: any
  ) {
    return this.appService.getAllJobs(parseInt(page, 10), parseInt(limit, 10), req.user.id);
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
