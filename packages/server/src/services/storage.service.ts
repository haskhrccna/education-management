import crypto from 'crypto';
import path from 'path';
import * as Minio from 'minio';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../lib/logger';

/**
 * S3-compatible object storage (MinIO locally, AWS S3 / R2 / Spaces in prod).
 *
 * Env:
 *  STORAGE_ENABLED        '1' enables; anything else (or unset) = local-disk mode (legacy).
 *  STORAGE_ENDPOINT       host[:port] of the S3 endpoint (e.g. 'localhost:9000', 's3.eu-west-1.amazonaws.com').
 *  STORAGE_PORT / STORAGE_USE_SSL   port override + TLS ('true'/'1').
 *  STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY    credentials.
 *  STORAGE_BUCKET         target bucket (default 'quran-review-media').
 *  STORAGE_PUBLIC_BASE_URL  optional CDN/base URL used to turn an object key
 *                           into a browser-playable URL on /files/complete when
 *                           no DB record exists. Without it the canonical
 *                           '/api/v1/files/recordings/:id' URL is used instead.
 */

const ENABLED = process.env.STORAGE_ENABLED === '1';
const BUCKET = process.env.STORAGE_BUCKET || 'quran-review-media';

let client: Minio.Client | null = null;

export const isStorageEnabled = () => ENABLED && client !== null;

const getClient = (): Minio.Client => {
  if (!client) {
    const endpoint = process.env.STORAGE_ENDPOINT || 'localhost';
    const port = process.env.STORAGE_PORT
      ? parseInt(process.env.STORAGE_PORT, 10)
      : endpoint.includes(':')
        ? parseInt(endpoint.split(':').pop()!, 10)
        : process.env.STORAGE_USE_SSL === 'true' || process.env.STORAGE_USE_SSL === '1'
          ? 443
          : 9000;
    const cleanEndpoint = endpoint.split(':')[0];
    client = new Minio.Client({
      endPoint: cleanEndpoint,
      port,
      useSSL: process.env.STORAGE_USE_SSL === 'true' || process.env.STORAGE_USE_SSL === '1',
      accessKey: process.env.STORAGE_ACCESS_KEY || '',
      secretKey: process.env.STORAGE_SECRET_KEY || '',
      region: process.env.STORAGE_REGION || '',
    });
  }
  return client;
};

const ALLOWED_MIME_PREFIXES = ['audio/', 'video/', 'image/'];

export const sanitizeObjectKey = (prefix: string, fileName: string): string => {
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${prefix.replace(/^\/+|\/+$/g, '')}/${crypto.randomUUID()}-${safeName}`;
};

/** Ensure the bucket exists (best-effort; called lazily, not at startup). */
let bucketChecked = false;
const ensureBucket = async () => {
  if (bucketChecked) return;
  try {
    const c = getClient();
    const exists = await c.bucketExists(BUCKET);
    if (!exists) await c.makeBucket(BUCKET);
    bucketChecked = true;
  } catch (err) {
    logger.warn({ err, bucket: BUCKET }, 'storage: bucket existence check failed');
    // Leave bucketChecked false — the presigned PUT will surface the error.
  }
};

export interface PresignResult {
  storageKey: string;
  uploadUrl: string;
  headers: Record<string, string> | undefined;
  expiresInSeconds: number;
}

export const presignUpload = async (
  prefix: string,
  fileName: string,
  contentType: string,
  fileSizeBytes?: number
): Promise<PresignResult> => {
  if (!isStorageEnabled() && !ENABLED) throw new AppError(503, 'Object storage is not enabled');

  const MAX_PRESIGN_BYTES = 500 * 1024 * 1024;
  if (fileSizeBytes != null && fileSizeBytes > MAX_PRESIGN_BYTES) {
    throw new AppError(413, 'File too large — maximum 500 MB');
  }

  if (
    contentType &&
    !ALLOWED_MIME_PREFIXES.some((p) => contentType.startsWith(p)) &&
    !['application/pdf'].includes(contentType)
  ) {
    throw new AppError(400, `Unsupported content type: ${contentType}`);
  }

  await ensureBucket();
  const storageKey = sanitizeObjectKey(prefix, fileName);
  const expiry = 15 * 60;
  const uploadUrl = await getClient().presignedPutObject(BUCKET, storageKey, expiry);

  return { storageKey, uploadUrl, headers: undefined, expiresInSeconds: expiry };
};

export interface CompleteResult {
  url: string;
  fileSizeBytes: number | null;
}

/** Verify the object landed in the bucket and resolve its final URL. */
export const completeUpload = async (storageKey: string): Promise<CompleteResult> => {
  if (!ENABLED) throw new AppError(503, 'Object storage is not enabled');

  const stat = await getClient()
    .statObject(BUCKET, storageKey)
    .catch(() => {
      throw new AppError(404, 'Uploaded object not found — did the presigned PUT succeed?');
    });

  const base = process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  const url = base ? `${base}/${BUCKET}/${storageKey}` : storageKey;
  return { url, fileSizeBytes: stat.size ?? null };
};

/** Delete an object; best-effort (used by the recordings cleanup path later). */
export const removeObject = async (storageKey: string): Promise<void> => {
  if (!ENABLED) return;
  try {
    await getClient().removeObject(BUCKET, storageKey);
  } catch (err) {
    logger.warn({ err, storageKey }, 'storage: removeObject failed');
  }
};

/** Pipe an object to an HTTP response (recording download path). The caller
 *  sets Content-Disposition; status defaults to 200. */
export const streamObject = async (storageKey: string, res: import('express').Response): Promise<void> => {
  if (!ENABLED) throw new AppError(503, 'Object storage is not enabled');
  const stream = await getClient()
    .getObject(BUCKET, storageKey)
    .catch(() => {
      throw new AppError(404, 'File not found');
    });
  await new Promise<void>((resolve, reject) => {
    stream.on('error', reject);
    stream.pipe(res).on('finish', resolve).on('error', reject);
  });
};

export const __resetStorageForTests = () => {
  client = null;
  bucketChecked = false;
};
