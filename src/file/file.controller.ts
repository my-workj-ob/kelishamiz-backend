import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { UploadService } from './uploadService';

@Controller('file')
export class FileController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly fileService: FileService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Faylni Vercel Blob-ga yuklash
      const vercelFileUrl = await this.uploadService.uploadFile(file);

      // Fayl URL'ini bazaga saqlash
      await this.fileService.saveFile(vercelFileUrl);

      return { url: vercelFileUrl };
    } catch (error) {
      throw new InternalServerErrorException(
        'Faylni yuklashda xatolik yuz berdi',
        error,
      );
    }
  }
}
