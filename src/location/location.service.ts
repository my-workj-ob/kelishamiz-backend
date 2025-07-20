import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { CreateDistrictDto, CreateRegionDto } from './dto/location.dto';
import { District } from './entities/district.entity';
import { Region } from './entities/region.entity';
import { Product } from './../product/entities/product.entity';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Region)
    private regionRepo: Repository<Region>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(District)
    private districtRepo: Repository<District>,
  ) {}

  createRegion(dto: CreateRegionDto) {
    return this.regionRepo.save(dto);
  }

  createDistrict(dto: CreateDistrictDto) {
    return this.districtRepo.save(dto);
  }

  getAllRegions() {
    return this.regionRepo.find({ relations: ['districts'] });
  }
  getAllDistricts() {
    return this.districtRepo.find({ relations: ['region'] });
  }

  getDistrictsByRegion(regionId: number) {
    return this.districtRepo.find({
      where: { regionId },
      relations: ['region'],
    });
  }

  async deleteDistrictRepo(id: number): Promise<DeleteResult | void> {
    if (!id) {
      throw new NotFoundException('ID berilmagan');
    }

    const district = await this.districtRepo.findOne({
      where: { id },
    });
    if (!district) {
      throw new NotFoundException(`District ${id} topilmadi`);
    }
    await this.districtRepo.delete(id);
  }
  async deleteRegionRepo(id: number): Promise<DeleteResult | void> {
    if (!id) {
      throw new NotFoundException('ID berilmagan');
    }

    const region = await this.regionRepo.findOne({ where: { id } });
    if (!region) {
      throw new NotFoundException(`Region ${id} topilmadi`);
    }

    // 1) Avval product jadvalidagi shu regionId bilan bog'liq yozuvlarni o'chirish
    await this.productRepo.delete({ regionId: id });

    // 2) Endi regionni o'chirish
    await this.regionRepo.delete(id);
  }
}
