import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

interface StorageGetResult {
  body: BodyInit;
  contentType?: string;
  size?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _s3Client: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _s3Module: any = null;

function isS3Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getS3(): Promise<{ client: any; bucket: string; s3: any } | null> {
  if (!isS3Configured()) return null;
  try {
    if (!_s3Module) {
      // Dynamic import to avoid build errors if @aws-sdk/client-s3 is not in client bundle
      _s3Module = await import("@aws-sdk/client-s3");
    }
    if (!_s3Client) {
      const accountId = process.env.R2_ACCOUNT_ID!;
      _s3Client = new _s3Module.S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }
    return { client: _s3Client, bucket: process.env.R2_BUCKET_NAME!, s3: _s3Module };
  } catch (err) {
    console.warn("[storage S3 init warning, using local disk fallback]:", err);
    return null;
  }
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
      const s3Context = await getS3();
      if (s3Context) {
        try {
          const { client, bucket, s3 } = s3Context;
          const res = await client.send(new s3.GetObjectCommand({ Bucket: bucket, Key: key }));
          if (!res.Body) return null;

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
        }
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
    const buffer = Buffer.isBuffer(data)
      ? data
      : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : Buffer.from(data.buffer, data.byteOffset, data.byteLength);

    // 1. S3 / R2 Mode
    if (isS3Configured()) {
      const s3Context = await getS3();
      if (s3Context) {
        const { client, bucket, s3 } = s3Context;
        await client.send(
          new s3.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        );
        return;
      }
    }

    // 2. Local VPS Disk Storage Mode
    const filePath = path.join(getUploadsDir(), key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
  },

  async delete(key: string): Promise<void> {
    // 1. S3 / R2 Mode
    if (isS3Configured()) {
      const s3Context = await getS3();
      if (s3Context) {
        try {
          const { client, bucket, s3 } = s3Context;
          await client.send(new s3.DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch (err) {
          console.warn("[storage S3 delete error]:", err);
        }
        return;
      }
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
