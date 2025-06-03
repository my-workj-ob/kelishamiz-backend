import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // <-- Buni qo'shing
import { BannerController } from './banner.controller';
import { BannerService } from './banner.service';
import { Banner } from './entities/banner.entity'; // <-- Banner entitysini qo'shing
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Banner]), // <-- Buni qo'shing. Banner entitysini shu modulga ta'minlaydi.
  ],
  controllers: [BannerController],
  providers: [BannerService, CloudinaryService],
  // Agar boshqa modullar BannerService dan foydalanishi kerak bo'lsa,
  // BannerService ni export qilishni unutmang:
  // exports: [BannerService],
})
export class BannerModule {}
