import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
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
    const { categoryId, options, ...propertyData } = createPropertyDto;

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Kategoriya ${categoryId} topilmadi`);
    }

    const property = this.propertyRepository.create({
      ...propertyData,
      category: { id: categoryId },
      options: propertyData.type === PropertyType.SELECT ? options : undefined,
    });

    return await this.propertyRepository.save(property);
  }

  async findAll(): Promise<Property[]> {
    return await this.propertyRepository.find({ relations: ['category'] });
  }

  async deleteProperty(id: number): Promise<DeleteResult | void> {
    if (!id) {
      throw new NotFoundException('ID berilmagan');
    }
    // Property mavjudligini tekshirish
    const property = await this.propertyRepository.findOne({
      where: { id },
    });
    if (!property) {
      throw new NotFoundException(`Property ${id} topilmadi`);
    }
    await this.propertyRepository.delete(id);
  }
}
