import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

/**
 * Almacenamiento PRIVADO de los originales. Los documentos legales y de
 * cumplimiento son confidenciales: nunca se publican (el original usaba
 * `ACL: public-read`). Se descargan solo a través de la API, con sesión y
 * comprobando que la persona pertenece al espacio de trabajo.
 */
export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9/_.-]+$/i;

function assertKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error(`Clave de almacenamiento inválida: ${key}`);
}

class LocalStorage implements Storage {
  private readonly root = path.resolve(env.UPLOAD_DIR);

  private resolve(key: string): string {
    assertKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Ruta fuera del directorio de subidas");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements Storage {
  private readonly client = new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "" },
  });

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    assertKey(key);
    // Sin ACL: el objeto hereda la política privada del bucket.
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: data, ContentType: contentType }));
  }

  async get(key: string): Promise<Buffer> {
    assertKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!result.Body) throw new Error("Objeto vacío");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async remove(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}

export const storage: Storage = env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
