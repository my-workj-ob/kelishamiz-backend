import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePropertyDto } from './../category/dto/create-property.dto';
import { Category } from './../category/entities/category.entity';
import { Property, PropertyType } from './../category/entities/property.entity';

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
    @InjectRepository(Category) // Category uchun repositoryni inyeksiya qilish
    private categoryRepository: Repository<Category>,
  ) {}
  //
  async create(createPropertyDto: CreatePropertyDto): Promise<Property> {
    const { categoryId, ...propertyData } = createPropertyDto;

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Kategoriya ${categoryId} topilmadi`);
    }

    const property = this.propertyRepository.create({
      ...propertyData,
      category: { id: categoryId },
      options: propertyData.type === PropertyType.SELECT ? [] : undefined,
    });
    return await this.propertyRepository.save(property);
  }

  async findAll(): Promise<Property[]> {
    return await this.propertyRepository.find({ relations: ['category'] });
  }
}
