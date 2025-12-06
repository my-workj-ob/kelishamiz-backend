    
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
import { del } from '@vercel/blob';
import { UploadService } from './../file/uploadService';
import { FileService } from './../file/file.service';

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(Banner)
    private bannerRepository: Repository<Banner>,
    private uploadService: UploadService, 
    private fileService: FileService, 
  ) {}

  async create(
    file: Express.Multer.File,
    createBannerDto: CreateBannerDto,
  ): Promise<Banner> {
    if (!file) {
      throw new BadRequestException('Rasm fayli yuklanmagan.');
    }
    
    const imageUrl = await this.uploadService.uploadFile(file);

    await this.fileService.saveFile(imageUrl); 
    if (!imageUrl) {
      throw new BadRequestException('Rasmni yuklashda xatolik yuz berdi.');
    }
    

    const banner = this.bannerRepository.create({
      ...createBannerDto,
      imageUrl: imageUrl, 
    });
    return this.bannerRepository.save(banner);
  }

  async findAll(placement?: string): Promise<Banner[]> {
    const query = this.bannerRepository.createQueryBuilder('banner');
    if (placement) {
      query.andWhere('banner.placement = :placement', { placement });
    }
    query.orderBy('banner.order', 'ASC');
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
    
      if (banner.imageUrl) {
        try {
          await del(banner.imageUrl);
        } catch (deleteError) {
          console.warn(
            `Eski rasmni o'chirishda xatolik yuz berdi: ${banner.imageUrl}`,
            deleteError,
          );
    
        }
      }
      const newImageUrl = await this.uploadService.uploadFile(file);
      banner.imageUrl = newImageUrl;
    }

    Object.assign(banner, updateBannerDto);
    return this.bannerRepository.save(banner);
  }

  async remove(id: number): Promise<void> {
    const banner = await this.findOne(id);
    if (banner.imageUrl) {
      try {
        await del(banner.imageUrl);
      } catch (deleteError) {
        console.error(
          `Rasmni o'chirishda xatolik yuz berdi: ${banner.imageUrl}`,
          deleteError,
        );
        throw new Error("Banner rasmini o'chirishda muammo yuz berdi!");
      }
    }
    await this.bannerRepository.delete(id);
  }

    
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
