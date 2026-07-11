import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../middleware/error.middleware';

export interface StorageAdapter {
  save(sourcePath: string, key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getLocalPath(key: string): string;
}

class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Defense-in-depth (M13 security review #5): resolve the key against baseDir
   * and reject anything that escapes it. Keys are server-derived today
   * (`url.split('/').pop()`, UUID-prefixed uploads), so this never rejects a
   * legitimate key — it only forecloses a future traversal path.
   */
  private resolveKey(key: string): string {
    const root = path.resolve(this.baseDir);
    const resolved = path.resolve(root, key);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new AppError(400, 'Invalid file path');
    }
    return resolved;
  }

  async ensureDir() {
    try {
      await fs.access(this.baseDir);
    } catch {
      await fs.mkdir(this.baseDir, { recursive: true });
    }
  }

  async save(sourcePath: string, key: string): Promise<string> {
    await this.ensureDir();
    const destPath = this.resolveKey(key);
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKey(key);
    try {
      await fs.unlink(filePath);
    } catch {
      /* ignore */
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  getLocalPath(key: string): string {
    return this.resolveKey(key);
  }
}

export const uploadStorage = new LocalStorageAdapter(path.join(process.cwd(), 'uploads'));
export const reportStorage = new LocalStorageAdapter(path.join(process.cwd(), 'reports'));
export const certificateStorage = new LocalStorageAdapter(path.join(process.cwd(), 'certificates'));
