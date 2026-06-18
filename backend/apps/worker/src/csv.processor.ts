import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CSV_NAME, CsvImportPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

@Processor(CSV_NAME)
export class CsvProcessor extends WorkerHost {
  private readonly logger = new Logger(CsvProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CsvImportPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    const { fileUrl, batchSize = 100 } = job.data;
    this.logger.log(`Downloading CSV from: ${fileUrl} (batch size: ${batchSize})`);

    const originalsDir = path.join(process.cwd(), 'uploads', 'originals');
    await fsp.mkdir(originalsDir, { recursive: true });

    const tempFilePath = path.join(originalsDir, `${job.id}.csv`);

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const fileStream = fs.createWriteStream(tempFilePath);

    // Save remote stream to local file. 
    // We cast to `any` because TS often conflicts between DOM ReadableStream and Node's stream/web ReadableStream typings.
    await pipeline(Readable.fromWeb(response.body as any), fileStream);

    // 1. Quick pass to count total lines for accurate progress tracking
    let totalExpectedRows = 0;
    await new Promise((resolve, reject) => {
      fs.createReadStream(tempFilePath)
        .on('data', (chunk) => {
          for (let i = 0; i < chunk.length; ++i) {
            if (chunk[i] === 10) totalExpectedRows++; // '\n'
          }
        })
        .on('end', () => resolve(undefined))
        .on('error', reject);
    });

    // Account for CSV header row
    totalExpectedRows = Math.max(0, totalExpectedRows - 1);

    // 2. Parse CSV
    let processedRows = 0;
    let importedRows = 0;
    let failedRows = 0;
    const errors: string[] = [];
    let batch: any[] = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      try {
        await this.prisma.product.createMany({
          data: batch,
        });
        importedRows += batch.length;
      } catch (e: any) {
        failedRows += batch.length;
        errors.push(`Failed to insert batch: ${e.message}`);
      }
      batch = [];
    };

    try {
      return await new Promise((resolve, reject) => {
        const parser = fs.createReadStream(tempFilePath).pipe(csvParser());
        
        parser.on('data', async (row) => {
            try {
              processedRows++;

              // Basic validation
              const name = row.name?.trim();
              const category = row.category?.trim();
              const price = parseFloat(row.price);
              const stock = parseInt(row.stock, 10);
              const description = row.description?.trim();

              if (!name || !category || isNaN(price) || isNaN(stock)) {
                failedRows++;
                errors.push(`Row ${processedRows}: Validation failed. Name, category, valid price, and stock are required.`);
                return;
              }

              batch.push({ name, category, price, stock, description });

              if (batch.length >= batchSize) {
                parser.pause();
                await flushBatch();
                const progress = totalExpectedRows > 0 ? Math.floor((processedRows / totalExpectedRows) * 100) : 0;
                await job.updateProgress(progress);
                parser.resume();
              }
            } catch (err) {
              parser.emit('error', err);
            }
          })
          .on('end', async () => {
            try {
              await flushBatch();
              
              resolve({
                totalRows: processedRows,
                importedRows,
                failedRows,
                errors,
              });
            } catch (err) {
              reject(err);
            }
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    } finally {
      // Ensure we aggressively clean up the temp file
      fsp.unlink(tempFilePath).catch(e => this.logger.error(`Failed to clean up temp file: ${e.message}`));
    }
  }

  @OnWorkerEvent('active')
  async onActive(job: Job) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} is active`);

    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: { status: 'active', attempts: job.attemptsMade },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: job.attemptsMade > 1 ? 'retried' : 'started',
          message: `Job started on attempt ${job.attemptsMade}`,
        },
      }),
    ]);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job, result: any) {
    if (!job.id) return;
    this.logger.log(`Job ${job.id} completed successfully`);

    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          result: result as any,
          completed_at: new Date(),
        },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: 'completed',
          message: 'Job completed successfully',
        },
      }),
    ]);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job | undefined, error: Error) {
    if (!job || !job.id) return;
    this.logger.error(`Job ${job.id} failed: ${error.message}`);

    const isPermanent = job.attemptsMade >= (job.opts.attempts || 1);

    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: isPermanent ? 'failed' : 'delayed',
          error: error.message,
          attempts: job.attemptsMade,
        },
      }),
      this.prisma.jobLog.create({
        data: {
          job_id: job.id,
          event_type: 'failed',
          message: error.message,
        },
      }),
    ]);
  }
}
