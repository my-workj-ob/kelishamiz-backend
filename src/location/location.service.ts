// location.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDistrictDto, CreateRegionDto } from './dto/location.dto';
import { District } from './entities/district.entity';
import { Region } from './entities/region.entity';

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Region)
    private regionRepo: Repository<Region>,

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

  // getDistrictsByRegion(regionId: number) {
  //   return this.districtRepo.find({ where: { regionId } });
  // }
}
