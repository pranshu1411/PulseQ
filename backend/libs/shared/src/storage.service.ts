import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName = 'pulseq';
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.s3Client = new S3Client({
      region: 'us-east-1', // Default region for MinIO
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async uploadBuffer(buffer: Buffer, filename: string, mimetype: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
        Body: buffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);
      return filename;
    } catch (error) {
      this.logger.error(`Failed to upload file ${filename} to MinIO`, error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async getFileStream(filename: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filename,
      });

      const response = await this.s3Client.send(command);
      return response.Body as Readable;
    } catch (error) {
      this.logger.error(`Failed to get file ${filename} from MinIO`, error);
      throw new InternalServerErrorException('Failed to retrieve file');
    }
  }

  async getPresignedUrl(filename: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
