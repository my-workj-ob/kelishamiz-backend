/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import { ProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { ProductProperty } from './entities/product-property-entity';
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
    @InjectRepository(ProductProperty)
    private productPropertyRepository: Repository<ProductProperty>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}
  async findAll() {
    return this.productRepository.find();
  }
  async findOne(id: number): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id },
      relations: ['profile'],
    });
  }
  async getLikedProducts(userId: number): Promise<Product[]> {
    // Foydalanuvchi mavjudligini tekshirib ko‘ramiz
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Foydalanuvchining like bosgan mahsulotlarini olish
    const likedProducts = await this.productRepository.find({
      where: {
        likes: {
          id: userId, // Foydalanuvchiga like bosgan mahsulotlar
        },
      },
      relations: ['likes'], // 'likes' orqali aloqani olish
    });

    return likedProducts;
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
    console.log(project);

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
    const {
      properties,
      page,
      limit,
      skip: rawSkip,
      take: rawTake,
      sortBy,
      sortOrder,
      ...otherFilters
    } = filters;

    const queryBuilder = this.productRepository.createQueryBuilder('product');
    const order = {};
    const relations = ['category', 'profile', 'district', 'district.region'];

    queryBuilder.leftJoinAndSelect('product.category', 'category');
    queryBuilder.leftJoinAndSelect('product.profile', 'profile');
    queryBuilder.leftJoinAndSelect('product.district', 'district');
    queryBuilder.leftJoinAndSelect('district.region', 'region');

    if (filters.categoryId && filters.categoryId !== 0) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price BETWEEN :minPrice AND :maxPrice', {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      });
    } else if (filters.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', {
        minPrice: filters.minPrice,
      });
    } else if (filters.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    if (filters.title) {
      queryBuilder.andWhere('product.title ILIKE :title', {
        title: `%${filters.title}%`,
      });
    }

    if (filters.ownProduct && userId) {
      queryBuilder.andWhere('product.profileId = :userId', { userId });
    }

    if (properties && Object.keys(properties).length > 0) {
      // Xususiyatlar bo'yicha filtrlash logikasi
      for (const key in properties) {
        const value = properties[key];

        // Agar value null yoki noto'g'ri formatda bo'lsa, bu filterni o'tkazib yuborish
        if (
          value !== null &&
          (typeof value === 'object' || Array.isArray(value))
        ) {
          queryBuilder.andWhere(`product.propertyValues @> :prop`, {
            prop: JSON.stringify({ [key]: value }),
          });
        } else {
          // Xato qiymatni tekshirish va xatolikni chiqarish
          console.error(`Invalid property value for ${key}: ${value}`);
        }
      }
    }

    // Boshqa filtrlar
    if (filters.paymentType) {
      queryBuilder.andWhere('product.paymentType = :paymentType', {
        paymentType: filters.paymentType,
      });
    }

    if (filters.currencyType) {
      queryBuilder.andWhere('product.currencyType = :currencyType', {
        currencyType: filters.currencyType,
      });
    }

    if (filters.negotiable !== undefined) {
      queryBuilder.andWhere('product.negotiable = :negotiable', {
        negotiable: filters.negotiable,
      });
    }

    if (filters.regionId && filters.districtId) {
      queryBuilder.andWhere(
        'district.id = :districtId AND region.id = :regionId',
        {
          districtId: filters.districtId,
          regionId: filters.regionId,
        },
      );
    } else if (filters.regionId) {
      queryBuilder.andWhere('region.id = :regionId', {
        regionId: filters.regionId,
      });
    } else if (filters.districtId) {
      queryBuilder.andWhere('district.id = :districtId', {
        districtId: filters.districtId,
      });
    }

    if (sortBy) {
      order[`product.${sortBy}`] = sortOrder || 'ASC'; // Tartiblash uchun 'product.' prefiksini qo'shamiz
      queryBuilder.orderBy(order);
    }

    const take = rawTake || limit || 10; // Agar `rawTake` yoki `limit` bo'lmasa, 10 ni default qilib olish
    const validLimit = take >= 1 ? take : 10; // Agar `take` 1 dan kichik bo'lsa, uni 10 ga o'zgartiradi
    const skip = rawSkip && rawSkip >= 0 ? rawSkip : 0; // Ensure skip is a valid number
    queryBuilder.skip(skip).take(validLimit); // `take` ni validLimit bilan o'zgartirish
    return queryBuilder.getMany();
  }

  async create(createProductDto: ProductDto, userId: number): Promise<Product> {
    const { categoryId, properties, ...productData } = createProductDto;
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
      profile: user,
      productProperties: properties?.map((propDto) =>
        this.productPropertyRepository.create({
          propertyId: propDto.propertyId,
          value: propDto.value,
        }),
      ),
    });

    await this.productRepository.save(product);

    try {
      return await this.productRepository.findOneOrFail({
        where: { id: product.id },
        relations: ['category', 'productProperties.property'],
      });
    } catch (error) {
      if (error instanceof EntityNotFoundError) {
        throw new InternalServerErrorException(
          `Mahsulotni qayta yuklashda xatolik yuz berdi (ID: ${product.id})`,
        );
      }
      throw error;
    }
  }
}
