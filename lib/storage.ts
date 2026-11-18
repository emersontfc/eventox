import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

interface StorageGetResult {
  body: BodyInit;
  contentType?: string;
  size?: number;
}

let _s3Client: S3Client | null = null;

function isS3Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getS3Client(): { client: S3Client; bucket: string } {
  if (!_s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID!;
    _s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return { client: _s3Client, bucket: process.env.R2_BUCKET_NAME! };
}

function getUploadsDir(): string {
  const custom = process.env.UPLOADS_DIR;
  if (custom) return path.resolve(custom);
  const dir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const storage = {
  async get(key: string): Promise<StorageGetResult | null> {
    // 1. S3 / R2 Mode
    if (isS3Configured()) {
      try {
        const { client, bucket } = getS3Client();
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;

        // Convert Node stream to web stream or Uint8Array
        const stream = res.Body as Readable;
        const webStream = Readable.toWeb(stream);

        return {
          body: webStream as unknown as BodyInit,
          contentType: res.ContentType,
          size: res.ContentLength,
        };
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.$metadata?.httpStatusCode === 404) return null;
        console.error("[storage S3 get error]:", err);
        return null;
      }
    }

    // 2. Local VPS Disk Storage Mode
    try {
      const filePath = path.join(getUploadsDir(), key);
      if (!fs.existsSync(filePath)) return null;

      const buffer = fs.readFileSync(filePath);
      const stat = fs.statSync(filePath);
      return {
        body: buffer,
        size: stat.size,
      };
    } catch (e) {
      console.error("[storage local get error]:", e);
      return null;
    }
  },

  async put(
    key: string,
    data: Buffer | ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<void> {
    const contentType = options?.httpMetadata?.contentType || "application/octet-stream";
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // 1. S3 / R2 Mode
    if (isS3Configured()) {
      const { client, bucket } = getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      return;
    }

    // 2. Local VPS Disk Storage Mode
    const filePath = path.join(getUploadsDir(), key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  },

  async delete(key: string): Promise<void> {
    // 1. S3 / R2 Mode
    if (isS3Configured()) {
      try {
        const { client, bucket } = getS3Client();
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        console.warn("[storage S3 delete error]:", err);
      }
      return;
    }

    // 2. Local VPS Disk Storage Mode
    try {
      const filePath = path.join(getUploadsDir(), key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn("[storage local delete error]:", err);
    }
  },
};
