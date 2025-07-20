import { Injectable } from '@nestjs/common';
import { put } from '@vercel/blob';

@Injectable()
export class UploadService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const blob = await put(file.originalname, file.buffer, {
        access: 'public',
        addRandomSuffix: true,
      });

      return blob.url;
    } catch (error) {
      console.error('Vercel Blob yuklashda xatolik:', error);
      throw new Error('Vercel Blob-ga fayl yuklashda muammo yuz berdi!');
    }
  }
}
