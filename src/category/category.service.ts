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
    console.log(createCategoryDto);

    if (createCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!parentCategory) {
        throw new Error('Ota kategoriya topilmadi');
      }
      category.parent = parentCategory;
    }
    const res = await this.categoryRepository.save(category);
    console.log(res);

    return res;
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

  async findAll(parentId: number | null = null): Promise<Category[]> {
    const categories = await this.categoryRepository.find({
      where: parentId ? { parent: { id: parentId } } : { parent: IsNull() },
      relations: ['parent'],
    });

    const tree = await Promise.all(
      categories.map(async (category) => ({
        ...category,
        children: await this.findAll(category.id),
      })),
    );

    return tree;
  }

  async findAllOnlyChildCategories(parentId: number): Promise<Category[]> {
    const parent = await this.categoryRepository.findOne({
      where: { id: parentId },
    });
    if (!parent) {
      throw new NotFoundException('category topilmadi');
    }

    const children = await this.categoryRepository.find({
      where: {
        parent: { id: parent.id },
      },
    });

    return children;
  }
  async findAllOnlyPropertiesByCategory(parentId: number): Promise<Category[]> {
    const children = await this.categoryRepository.find({
      where: {
        id: parentId,
      },
      relations: ['properties'],
    });

    return children;
  }

  async updateCategory(id: number, body: any) {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('category topilmadi');
    }

    const updated = Object.assign(category, body);

    await this.categoryRepository.save(updated);

    return {
      message: 'Kategoriya muvaffaqiyatli yangilandi',
      data: updated,
    };
  }

  async deleteCategory(id) {
    const category = await this.categoryRepository.findOne({
      where: { id: id },
    });

    if (!category) {
      throw new NotFoundException('category topilmadi');
    }

    const deleteCategory = await this.categoryRepository.delete({ id: id });

    return deleteCategory;
  }
}
