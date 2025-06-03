import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <-- Buni qo'shing
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';
import { Banner } from './entities/banner.entity';
import { UploadService } from './../file/uploadService';
import { FileService } from './../file/file.service';
import { FileEntity } from './../file/entities/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Banner, FileEntity]), // <-- Buni qo'shing. Banner entitysini shu modulga ta'minlaydi.
  ],
  controllers: [BannerController],
  providers: [BannerService, UploadService, FileService],
  // Agar boshqa modullar BannerService dan foydalanishi kerak bo'lsa,
  // BannerService ni export qilishni unutmang:
  // exports: [BannerService],
})
export class BannerModule {}
