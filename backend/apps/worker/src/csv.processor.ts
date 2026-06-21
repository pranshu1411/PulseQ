import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CSV_NAME, CsvImportPayload, StorageService } from '@app/shared';
import { PrismaService } from '@app/prisma';
import { BaseProcessor } from './base.processor';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

@Processor(CSV_NAME, { 
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 60000,
  }
})
export class CsvProcessor extends BaseProcessor {
  protected readonly logger = new Logger(CsvProcessor.name);

  constructor(
    protected readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    super(prisma);
  }

  async process(job: Job<CsvImportPayload, any, string>): Promise<any> {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    const { fileUrl, batchSize = 100 } = job.data;
    this.logger.log(`Downloading CSV from: ${fileUrl} (batch size: ${batchSize})`);

    const dbJob = await this.prisma.job.findUnique({ where: { id: job.id } });
    if (!dbJob) throw new Error('Job not found in DB');
    const userId = dbJob.userId;

    const originalsDir = path.join(process.cwd(), 'apps', 'worker', 'uploads', 'originals');
    await fsp.mkdir(originalsDir, { recursive: true });

    const tempFilePath = path.join(originalsDir, `${job.id}.csv`);

    const stream = await this.storageService.getFileStream(fileUrl);

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
    await pipeline(stream, lineCounter, fileStream);

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
      const parser = fs.createReadStream(tempFilePath).pipe(csvParser());
      
      try {
        for await (const row of parser) {
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
            continue;
          }

          batch.push({ name, category, price, stock, description, userId });

          if (batch.length >= batchSize) {
            await flushBatch();
            const progress = totalExpectedRows > 0 ? Math.floor((processedRows / totalExpectedRows) * 100) : 0;
            await job.updateProgress(progress);
          }
        }
        
        await flushBatch();
        
        if (processedRows > 0 && importedRows === 0) {
          throw new Error('All rows failed validation. The file might not be a valid CSV format.');
        }

        return {
          totalRows: processedRows,
          importedRows,
          failedRows,
          errors: errors.slice(0, 50),
        };
      } catch (err) {
        throw err;
      }
    } finally {
      // Ensure we aggressively clean up the temp file
      fsp.unlink(tempFilePath).catch(e => this.logger.error(`Failed to clean up temp file: ${e.message}`));
    }
  }
}
