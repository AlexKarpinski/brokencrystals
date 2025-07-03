import { Injectable, Logger } from '@nestjs/common';
import { Readable, Stream } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { CloudProvidersMetaData } from './cloud.providers.metadata';
import { R_OK } from 'constants';
import { URL } from 'url';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private cloudProviders = new CloudProvidersMetaData();

  public isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      // Allow only specific protocols
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }
      // Add more validation logic if needed, e.g., checking hostname
      // Disallow access to private IP ranges
      const hostname = parsedUrl.hostname;
      if (/^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1]))/.test(hostname)) {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  private isValidPath(filePath: string): boolean {
    // Allow only specific directories
    const allowedBasePath = path.resolve(process.cwd(), 'config/products/crystals');
    const resolvedPath = path.resolve(process.cwd(), filePath);
    return resolvedPath.startsWith(allowedBasePath);
  }

  async getFile(file: string): Promise<Stream> {
    this.logger.log(`Reading file: ${file}`);

    if (!this.isValidPath(file) && !file.startsWith('http')) {
      throw new Error('Access to this file path is not allowed');
    }

    try {
      if (file.startsWith('/')) {
        await fs.promises.access(file, R_OK);

        return fs.createReadStream(file);
      } else if (file.startsWith('http')) {
        if (!this.isValidUrl(file)) {
          throw new Error('Invalid URL');
        }
        const content = await this.cloudProviders.get(file);

        if (content) {
          return Readable.from(content);
        } else {
          throw new Error(`no such file or directory, access '${file}'`);
        }
      } else {
        file = path.resolve(process.cwd(), file);

        await fs.promises.access(file, R_OK);

        return fs.createReadStream(file);
      }
    } catch (err) {
      this.logger.error(`Error accessing file: ${err.message}`);
      throw new Error('File access error');
    }
  }

  async deleteFile(file: string): Promise<boolean> {
    if (file.startsWith('/')) {
      throw new Error('cannot delete file from this location');
    } else if (file.startsWith('http')) {
      throw new Error('cannot delete file from this location');
    } else {
      file = path.resolve(process.cwd(), file);
      await fs.promises.unlink(file);
      return true;
    }
  }
}
