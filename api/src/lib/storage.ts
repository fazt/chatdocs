import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const client = new S3Client({
  endpoint: config.spaces.endpoint,
  region: config.spaces.region,
  credentials: {
    accessKeyId: config.spaces.accessKeyId,
    secretAccessKey: config.spaces.secretAccessKey,
  },
  forcePathStyle: false,
});

export async function uploadFile(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.spaces.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: "public-read",
    })
  );

  const base = config.spaces.publicUrl || `${config.spaces.endpoint}/${config.spaces.bucket}`;
  return `${base}/${key}`;
}
