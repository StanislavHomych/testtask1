import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  readonly client: S3Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    const endpoint = config.get<string>('AWS_S3_ENDPOINT');

    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
      // Browser PUTs cannot replay SDK-default CRC32 checksums in the signature.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      ...(endpoint
        ? {
            endpoint,
            forcePathStyle: true,
          }
        : {}),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.assertBucketAccessible();
      this.logger.log(`S3 bucket is reachable: ${this.bucket}`);
    } catch (error) {
      const awsError = error as {
        message?: string;
        Code?: string;
        name?: string;
      };
      const code = awsError.Code ?? awsError.name ?? 'UnknownError';
      const message = awsError.message ?? 'Unknown error';
      this.logger.warn(
        `S3 bucket is not reachable yet (${this.bucket}): ${code} ${message}`,
      );
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  fileObjectKey(dataRoomId: string, fileId: string): string {
    return `data-rooms/${dataRoomId}/files/${fileId}`;
  }

  async assertBucketAccessible(): Promise<void> {
    await this.client.send(
      new HeadBucketCommand({
        Bucket: this.bucket,
      }),
    );
  }

  async createUploadUrl(
    objectKey: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return { url, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }

  async createDownloadUrl(
    objectKey: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
      { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
    );

    return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }

  async putObject(
    objectKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      const awsError = error as {
        Code?: string;
        message?: string;
        name?: string;
      };
      const code = awsError.Code ?? awsError.name ?? 'UnknownError';
      this.logger.error(
        `PutObject failed for ${objectKey}: ${code} ${awsError.message ?? ''}`.trim(),
      );
      throw error;
    }
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(
    objectKey: string,
  ): Promise<{ contentLength: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return {
        contentLength: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch {
      return null;
    }
  }

  async getObjectPrefix(
    objectKey: string,
    byteLength = 5,
  ): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Range: `bytes=0-${Math.max(0, byteLength - 1)}`,
        }),
      );
      if (!result.Body) {
        return null;
      }
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  async deleteObjectsBestEffort(objectKeys: string[]): Promise<void> {
    const unique = [...new Set(objectKeys.filter(Boolean))];
    const batchSize = 25;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (key) => {
          try {
            await this.deleteObject(key);
          } catch {
            // Soft-deleted metadata remains authoritative; orphan cleanup can retry.
          }
        }),
      );
    }
  }
}
