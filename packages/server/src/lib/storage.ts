import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger';

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

  async ensureDir() {
    try { await fs.access(this.baseDir); } catch { await fs.mkdir(this.baseDir, { recursive: true }); }
  }

  async save(sourcePath: string, key: string): Promise<string> {
    await this.ensureDir();
    const destPath = path.join(this.baseDir, key);
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    try { await fs.unlink(filePath); } catch { /* ignore */ }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.baseDir, key));
      return true;
    } catch { return false; }
  }

  getLocalPath(key: string): string {
    return path.join(this.baseDir, key);
  }
}

export const uploadStorage = new LocalStorageAdapter(path.join(process.cwd(), 'uploads'));
export const reportStorage = new LocalStorageAdapter(path.join(process.cwd(), 'reports'));
