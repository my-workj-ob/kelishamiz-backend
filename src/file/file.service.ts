import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FileEntity } from './entities/file.entity';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async saveFile(fileUrl: string): Promise<FileEntity> {
    try {
      const file = this.fileRepository.create({ url: fileUrl });
      return await this.fileRepository.save(file);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while saving file: ${error}`,
      );
    }
  }

  async deleteFileByUrl(fileUrl: string): Promise<void> {
    try {
      const filePath = this.getFilePathFromUrl(fileUrl);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }

      await this.fileRepository.delete({ url: fileUrl });
    } catch (error) {
      throw new InternalServerErrorException(
        `Error occurred while deleting file: ${error}`,
      );
    }
  }

  private getFilePathFromUrl(fileUrl: string): string {
    const basePath = path.resolve(__dirname, '../../public'); // public papka yo'li
    const urlPath = new URL(fileUrl).pathname; // /uploads/file.jpg

    return path.join(basePath, urlPath);
  }
}
