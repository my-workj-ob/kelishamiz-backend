import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
}
