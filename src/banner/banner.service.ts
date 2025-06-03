// src/banner/banner.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
    private cloudinaryService: CloudinaryService, // Cloudinary service injeckt qilish
  ) {}

  async create(
    file: Express.Multer.File,
    createBannerDto: CreateBannerDto,
  ): Promise<Banner> {
    if (!file) {
      throw new BadRequestException('Rasm fayli yuklanmagan.');
    }
    const uploadResult = await this.cloudinaryService.uploadFile(
      file,
      'banners',
    ); // 'banners' papkasiga yuklash
    const banner = this.bannerRepository.create({
      ...createBannerDto,
      imageUrl: uploadResult.secure_url,
    });
    return this.bannerRepository.save(banner);
  }

  async findAll(placement?: string): Promise<Banner[]> {
    const query = this.bannerRepository.createQueryBuilder('banner');
    if (placement) {
      query.andWhere('banner.placement = :placement', { placement });
    }
    query.orderBy('banner.order', 'ASC'); // Tartib bo'yicha saralash
    return query.getMany();
  }

  async findOne(id: number): Promise<Banner> {
    const banner = await this.bannerRepository.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`ID: ${id} bo'lgan banner topilmadi.`);
    }
    return banner;
  }

  async update(
    id: number,
    file: Express.Multer.File,
    updateBannerDto: UpdateBannerDto,
  ): Promise<Banner> {
    const banner = await this.findOne(id);

    if (file) {
      // Eski rasmni o'chirish (ixtiyoriy, lekin tavsiya etiladi)
      if (banner.imageUrl) {
        await this.cloudinaryService.deleteFile(banner.imageUrl);
      }
      const uploadResult = await this.cloudinaryService.uploadFile(
        file,
        'banners',
      );
      banner.imageUrl = uploadResult.secure_url;
    }

    Object.assign(banner, updateBannerDto);
    return this.bannerRepository.save(banner);
  }

  async remove(id: number): Promise<void> {
    const banner = await this.findOne(id);
    if (banner.imageUrl) {
      await this.cloudinaryService.deleteFile(banner.imageUrl); // Rasmni Cloudinarydan o'chirish
    }
    await this.bannerRepository.delete(id);
  }

  // Jamoat uchun faol bannerlarni olish
  async findActiveByPlacement(placement: string): Promise<Banner[]> {
    return this.bannerRepository.find({
      where: {
        placement,
        isActive: true,
      },
      order: {
        order: 'ASC',
      },
    });
  }
}
