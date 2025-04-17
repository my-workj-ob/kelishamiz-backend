/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindManyOptions,
  ILike,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import { ProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { Product } from './entities/product.entity';
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,

    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,

    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  async findAll() {
    return this.productRepository.find();
  }
  async findOne(id: number): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id },
    });
  }

  async toggleLike(projectId: number, userId: number): Promise<boolean> {
    const project = await this.productRepository.findOne({
      where: { id: projectId },
      relations: ['likes'],
    });

    if (!project) {
      throw new NotFoundException('Product not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // User oldin like bosganmi?
    const hasLiked = project.likes.some((likeUser) => likeUser.id === userId);

    if (hasLiked) {
      project.likes = project.likes.filter(
        (likeUser) => likeUser.id !== userId,
      );
      project.likesCount -= 1; // ✅ Like olib tashlanganda kamaytirish
    } else {
      project.likes.push(user);
      project.likesCount += 1; // ✅ Like qo‘shilganda oshirish
    }

    await this.productRepository.save(project);
    return !hasLiked; // True → Liked, False → Unliked
  }

  async checkLikeStatus(projectId: number, userId: number): Promise<boolean> {
    const project = await this.productRepository.findOne({
      where: { id: projectId },
      relations: ['likes'],
    });

    console.log(project?.likes);

    if (!project) throw new NotFoundException('Product not found');

    return project.likes.some((user) => user.id === userId);
  }

  async addComment(portfolioId: string) {
    const portfolio = await this.productRepository.findOne({
      where: { id: Number(portfolioId) },
      relations: ['comments'],
    });

    if (!portfolio) throw new NotFoundException('Product not found');

    portfolio.commentsCount += 1;
    return this.productRepository.save(portfolio);
  }

  async filter(filters: GetProductsDto, userId?: number): Promise<Product[]> {
    const where: FindManyOptions<Product>['where'] = {};
    const order = {};
    const relations = ['category', 'profile']; // 'profile' qo'shilgan

    // Kategoriya bo'yicha filtrlash
    if (filters.categoryId && filters.categoryId !== 0) {
      where.categoryId = filters.categoryId;
    }

    // Narx bo'yicha filtrlash
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      where.price = Between(filters.minPrice, filters.maxPrice);
    } else if (filters.minPrice !== undefined) {
      where.price = MoreThanOrEqual(filters.minPrice);
    } else if (filters.maxPrice !== undefined) {
      where.price = LessThanOrEqual(filters.maxPrice);
    }

    // Sarlavha bo'yicha qidiruv
    if (filters.title) {
      where.title = ILike(`%${filters.title}%`);
    }

    // Faqat o'z mahsulotlarini ko'rish
    if (filters.ownProduct && userId) {
      where['profile'] = { id: userId }; // 'profile' orqali filtrlash
    }

    // Xususiyatlar bo'yicha murakkab filtrlash (agar kerak bo'lsa)
    if (filters.properties && Object.keys(filters.properties).length > 0) {
      where.propertyValues = {};
      for (const key in filters.properties) {
        const value = filters.properties[key];
        if (Array.isArray(value)) {
          where.propertyValues[key] = In(value);
        } else if (
          typeof value === 'object' &&
          (value.gte !== undefined || value.lte !== undefined)
        ) {
          const conditions = {};
          if (value.gte !== undefined) {
            conditions['gte'] = value.gte;
          }
          if (value.lte !== undefined) {
            conditions['lte'] = value.lte;
          }
          where.propertyValues[key] = conditions;
        } else if (value !== undefined) {
          where.propertyValues[key] = value;
        }
      }
    }

    // To'lov turi bo'yicha filtrlash
    if (filters.paymentType) {
      where.paymentType = filters.paymentType;
    }

    // Valyuta turi bo'yicha filtrlash
    if (filters.currencyType) {
      where.currencyType = filters.currencyType;
    }

    // Kelishish mumkinligi bo'yicha filtrlash
    if (filters.negotiable !== undefined) {
      where.negotiable = filters.negotiable;
    }

    // Tartiblash (Sorting)
    if (filters.sortBy) {
      order[filters.sortBy] = filters.sortOrder || 'ASC';
    }

    const skip = filters.skip || 0;
    const take = filters.take || 10;

    return this.productRepository.find({
      where,
      relations,
      skip,
      take,
      order,
    });
  }

  async create(createProductDto: ProductDto, userId: number): Promise<Product> {
    const { categoryId, properties, propertyValues, ...productData } =
      createProductDto;
    console.log(userId);

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['properties'],
    });

    if (!category)
      throw new NotFoundException(`Kategoriya ${categoryId} topilmadi`);

    const user = await this.profileRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(`Foydalanuvchi ${userId} topilmadi`);

    const product = this.productRepository.create({
      ...productData,
      category,
      propertyValues,
      profileId: user.id,
    });

    if (properties?.length) {
      const propertyEntities = await this.propertyRepository.findByIds(
        properties.map((p) => p.id),
      );
      product.properties = propertyEntities;
    }

    return this.productRepository.save(product);
  }
}
