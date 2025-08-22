import { Injectable } from '@nestjs/common';
import { put } from '@vercel/blob';

@Injectable()
export class UploadService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    // .env dan tokenni olamiz
    const token =
      'vercel_blob_rw_Hl2g4VY0JzwRnHdy_88alBWTCk3BJPoDyuNMIP3E3FCm8CI';
    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN topilmadi!');
    }
    try {
      const blob = await put(file.originalname, file.buffer, {
        access: 'public',
        addRandomSuffix: true,
        token,
      });

      return blob.url;
    } catch (error) {
      console.error('Vercel Blob yuklashda xatolik:', error);
      throw new Error('Vercel Blob-ga fayl yuklashda muammo yuz berdi!');
    }
  }
}
