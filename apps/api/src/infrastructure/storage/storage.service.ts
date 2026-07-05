import { Injectable, OnModuleInit, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import * as Minio from "minio"

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private minioClient: Minio.Client
  private bucketName: string

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("MINIO_ENDPOINT") as string
    const port = this.configService.get<number>("MINIO_PORT")
    const useSsl = this.configService.get<boolean>("MINIO_USE_SSL")
    const accessKey = this.configService.get<string>("MINIO_ACCESS_KEY")
    const secretKey = this.configService.get<string>("MINIO_SECRET_KEY")

    this.minioClient = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSsl,
      accessKey: accessKey,
      secretKey: secretKey,
    })

    this.bucketName = this.configService.get<string>("MINIO_BUCKET") as string
  }

  async onModuleInit() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName)
      if (!bucketExists) {
        this.logger.log(
          `Bucket "${this.bucketName}" does not exist. Creating it...`,
        )
        await this.minioClient.makeBucket(this.bucketName, "us-east-1")

        // Set public read-only policy for bucket
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        }
        await this.minioClient.setBucketPolicy(
          this.bucketName,
          JSON.stringify(policy),
        )
        this.logger.log(
          `Bucket "${this.bucketName}" created and public read-only policy set successfully.`,
        )
      } else {
        this.logger.log(`Bucket "${this.bucketName}" already exists.`)
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize MinIO bucket "${this.bucketName}":`,
        error,
      )
    }
  }

  /**
   * Uploads a file to MinIO and returns the public HTTP URL.
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      this.logger.log(
        `Uploading file to MinIO: key=${key}, mimeType=${mimeType}, size=${fileBuffer.length} bytes`,
      )
      await this.minioClient.putObject(
        this.bucketName,
        key,
        fileBuffer,
        fileBuffer.length,
        {
          "Content-Type": mimeType,
        },
      )

      const publicUrl = this.configService.get<string>("MINIO_PUBLIC_URL")
      if (publicUrl) {
        return `${publicUrl}/${key}`
      }

      const endpoint = this.configService.get<string>("MINIO_ENDPOINT")
      const port = this.configService.get<number>("MINIO_PORT")
      const useSsl = this.configService.get<boolean>("MINIO_USE_SSL")
      const protocol = useSsl ? "https" : "http"

      // Public URL of the uploaded object
      return `${protocol}://${endpoint}:${port}/${this.bucketName}/${key}`
    } catch (error) {
      this.logger.error(`Failed to upload file to MinIO (key=${key}):`, error)
      throw error
    }
  }

  /**
   * Deletes a file from MinIO.
   */
  async deleteFile(key: string): Promise<void> {
    try {
      this.logger.log(`Deleting file from MinIO: key=${key}`)
      await this.minioClient.removeObject(this.bucketName, key)
    } catch (error) {
      this.logger.error(`Failed to delete file from MinIO (key=${key}):`, error)
      throw error
    }
  }
}
