/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);

    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!parentCategory) {
        throw new Error('Ota kategoriya topilmadi');
      }
      category.parent = parentCategory;
    }

    return await this.categoryRepository.save(category);
  }

  async findOne(id: number): Promise<Category> {
    console.log(id);

    const existCategoryById = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'properties'],
    });
    if (!existCategoryById) {
      throw new NotFoundException('category topilmadi');
    }
    return existCategoryById;
  }
  async findAll(parentId: string | null | undefined): Promise<Category[]> {
    const whereClause: any = {};
    let relations: string[] = [];

    if (parentId === undefined) {
      relations = ['parent', 'children'];
    } else if (parentId === 'null') {
      whereClause.parent = IsNull();
    } else if (parentId) {
      whereClause.parent = { id: Number(parentId) };
      relations = ['children', 'parent'];
    }

    return await this.categoryRepository.find({
      where: whereClause,
      relations: relations,
    });
  }
}
