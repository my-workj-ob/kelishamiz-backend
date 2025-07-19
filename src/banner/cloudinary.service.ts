    
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryResponse } from './cloudinary-response';
const streamifier = require('streamifier');

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<CloudinaryResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `your_app_name/${folder}` }, // Masalan, 'your_app_name/banners'
        (error, result) => {
          if (error) return reject(error);
          if (result) {
            resolve({
              asset_id: result.asset_id,
              version_id: result.version_id,
              ...result,
              created_at: new Date(result.created_at), // Convert created_at to Date
            } as CloudinaryResponse);
          } else {
            reject(new Error('Upload result is undefined'));
          }
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(imageUrl: string): Promise<any> {
    
    const publicId = (imageUrl.split('/').pop() ?? '').split('.')[0]; // Bu oddiy usul, aniqroq parser kerak bo'lishi mumkin
    if (!publicId) return;

    try {
      return await cloudinary.uploader.destroy(
        `your_app_name/banners/${publicId}`,
      );
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
    
    }
  }
}
