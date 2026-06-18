import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CSV_NAME, CsvImportPayload } from '@app/shared';
import { PrismaService } from '@app/prisma';
import { BaseProcessor } from './base.processor';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

@Processor(CSV_NAME)
export class CsvProcessor extends BaseProcessor {
  protected readonly logger = new Logger(CsvProcessor.name);

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  async process(job: Job<CsvImportPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    const { fileUrl, batchSize = 100 } = job.data;
    this.logger.log(`Downloading CSV from: ${fileUrl} (batch size: ${batchSize})`);

    const originalsDir = path.join(process.cwd(), 'apps', 'worker', 'uploads', 'originals');
    await fsp.mkdir(originalsDir, { recursive: true });

    const tempFilePath = path.join(originalsDir, `${job.id}.csv`);

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    let totalExpectedRows = 0;
    const lineCounter = new Transform({
      transform(chunk, encoding, callback) {
        for (let i = 0; i < chunk.length; ++i) {
          if (chunk[i] === 10) totalExpectedRows++; // '\n'
        }
        callback(null, chunk);
      }
    });

    const fileStream = fs.createWriteStream(tempFilePath);

    // Save remote stream to local file and count lines simultaneously
    await pipeline(Readable.fromWeb(response.body as any), lineCounter, fileStream);

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
}
