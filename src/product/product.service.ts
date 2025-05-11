/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, ILike, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import { ProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { ProductProperty } from './entities/product-property-entity';
import { Product } from './entities/product.entity';
import { FileService } from './../file/file.service';
import { UploadService } from './../file/uploadService';
import { ProductImage } from './entities/Product-Image.entity';

interface ImageMetaDto {
  isMainImage: boolean;
}

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
    private productPropertyRepository: Repository<ProductProperty>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly fileService: FileService,
    private readonly uploadService: UploadService,
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
  ) {}

  async findAll() {
    return this.productRepository.find();
  }

  async incrementViewCount(productId: number) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('mahsulot topilmadi');
    }

    product.viewCount += 1;
    await this.productRepository.save(product);
  }

  async findOne(title: string, categoryId?: number): Promise<Product | null> {
    const where: any = { title };

    if (categoryId) {
      where.category = { id: categoryId };
    }

    return this.productRepository.findOne({
      where,
      relations: [
        'profile',
        'productProperties',
        'productProperties.property',
        'images',
        'category',
      ],
    });
  }
  async findById(id: number): Promise<Product | null> {
    const where: any = { id };

    return this.productRepository.findOne({
      where,
      relations: [
        'profile',
        'productProperties',
        'productProperties.property',
        'images',
        'category',
      ],
    });
  }

  async getFullTextSearchByCategory(
    query: string,
    categoryId: number,
    location?: string,
  ): Promise<Product[]> {
    try {
      const qb = this.productRepository.createQueryBuilder('product');

      // SIMILARITY ni oldindan hisoblash va alias berish
      qb.addSelect('SIMILARITY(product.title, :query)', 'title_similarity')
        .addSelect('SIMILARITY(product.description, :query)', 'desc_similarity')
        .setParameter('query', query);

      // Order by aliaslar
      qb.orderBy('title_similarity', 'DESC').addOrderBy(
        'desc_similarity',
        'DESC',
      );

      const words = query.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        throw new NotFoundException('Qidiruv so‘zi bo‘sh');
      }

      const queryString = words.join(' ');

      // WHERE
      qb.where(
        '(product.title % :queryString OR product.description % :queryString)',
        { queryString },
      );

      qb.andWhere('product.categoryId = :categoryId', { categoryId });

      if (location) {
        qb.andWhere('LOWER(product.location) ILIKE LOWER(:location)', {
          location: `%${location}%`,
        });
      }

      // JOINlar
      qb.leftJoinAndSelect('product.profile', 'profile')
        .leftJoinAndSelect('product.productProperties', 'productProperties')
        .leftJoinAndSelect('productProperties.property', 'property')
        .leftJoinAndSelect('product.images', 'images')
        .take(20);
      const products = await qb.getMany();

      if (products.length === 0) {
        throw new NotFoundException('Mos mahsulotlar topilmadi');
      }

      return products;
    } catch (error) {
      console.error('Error during product search:', error);
      throw new NotFoundException('Qidiruvda xatolik yuz berdi');
    }
  }

  async getSmartSearchByIdAndCategory(
    title: string,
    categoryId: number,
  ): Promise<Product[]> {
    if (!title || !categoryId) {
      throw new NotFoundException('title va categoryId talab qilinadi');
    }

    const product = await this.findOne(title, categoryId);

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi');
    }

    const combinedQuery = `${product.title} ${product.description || ''}`;

    return this.getFullTextSearchByCategory(combinedQuery.trim(), categoryId);
  }

  async getUserProducts(id: number) {
    return this.profileRepository.findOne({
      where: { id },
      relations: ['products'],
    });
  }

  async getLikedProducts(userId: number): Promise<Product[]> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
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
      sortBy,
      sortOrder,
      skip: rawSkip,
      take: rawTake,
      limit,
      ...otherFilters
    } = filters;

    const queryBuilder = this.productRepository.createQueryBuilder('product');

    // JOINlar
    queryBuilder
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.profile', 'profile')
      .leftJoinAndSelect('product.district', 'district')
      .leftJoinAndSelect('district.region', 'region')
      .leftJoinAndSelect('product.images', 'images');

    // ===== Filterlar boshlanishi =====

    // Kategoriya
    if (filters.categoryId !== null && filters.categoryId !== undefined) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    // Narx oralig'i
    if (filters.minPrice !== null && filters.maxPrice !== null) {
      queryBuilder.andWhere('product.price BETWEEN :minPrice AND :maxPrice', {
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
      });
    } else if (filters.minPrice !== null && filters.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', {
        minPrice: filters.minPrice,
      });
    } else if (filters.maxPrice !== null && filters.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    // Sarlavha (title) bo'yicha qidirish
    if (filters.title) {
      queryBuilder.andWhere('product.title ILIKE :title', {
        title: `%${filters.title}%`,
      });
    }

    // Faqat o'zining mahsulotlari
    if (filters.ownProduct !== undefined && userId) {
      queryBuilder.andWhere('product.profileId = :userId', { userId });
    }

    // PropertyValues (xususiyatlar) bo'yicha qidirish
    if (properties && Object.keys(properties).length > 0) {
      for (const key of Object.keys(properties)) {
        const value = properties[key];
        if (value !== null && typeof value === 'object') {
          queryBuilder.andWhere('product.propertyValues @> :prop', {
            prop: JSON.stringify({ [key]: value }),
          });
        }
      }
    }

    // To'lov turi
    if (filters.paymentType !== null && filters.paymentType !== undefined) {
      queryBuilder.andWhere('product.paymentType = :paymentType', {
        paymentType: filters.paymentType,
      });
    }

    // Valyuta turi
    if (filters.currencyType !== null && filters.currencyType !== undefined) {
      queryBuilder.andWhere('product.currencyType = :currencyType', {
        currencyType: filters.currencyType,
      });
    }

    // Kelishish imkoniyati (negotiable)
    if (filters.negotiable !== undefined) {
      queryBuilder.andWhere('product.negotiable = :negotiable', {
        negotiable: filters.negotiable,
      });
    }

    // Hudud va tuman bo'yicha qidirish
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

    // ===== Filterlar tugashi =====

    // Tartiblash
    if (sortBy) {
      queryBuilder.orderBy(
        `product.${sortBy}`,
        sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      );
    }

    // Paginatsiya
    const take = rawTake || limit || 10;
    const skip = rawSkip !== undefined ? rawSkip : 0;

    queryBuilder.skip(Math.max(skip, 0)).take(Math.max(take, 1));

    // Ma'lumotlarni qaytarish
    return queryBuilder.getMany();
  }

  async create(
    files: Express.Multer.File[],
    createProductDto: Omit<ProductDto, 'images'>,
    userId: number,
  ): Promise<Product> {
    const { categoryId, properties, ...productData } = createProductDto;
    console.log('Fayllar:', files);
    console.log("Mahsulot ma'lumotlari:", createProductDto);
    console.log('Foydalanuvchi IDsi:', userId);

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException(`Kategoriya topilmadi`);
    console.log('Topilgan kategoriya:', category);

    const user = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!user) throw new NotFoundException(`Foydalanuvchi topilmadi`);
    console.log('Topilgan foydalanuvchi profili:', user);

    const productImages: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const vercelFileUrl = await this.uploadService.uploadFile(file);

        await this.fileService.saveFile(vercelFileUrl);

        const newProductImage = this.productImageRepository.create({
          url: vercelFileUrl,
        });

        productImages.push(newProductImage);
      } catch (error) {
        console.error('Yuklash xatoligi:', error);
        console.log("Xatolikka sabab bo'lgan fayllar:", files);
        throw new InternalServerErrorException(
          `Rasm yuklashda xatolik: ${error.message}`,
        );
      }
    }
    console.log('Yaratilgan mahsulot rasmlari:', productImages);

    const product = this.productRepository.create({
      ...productData,
      category,
      profile: user,
      images: productImages,
      regionId: Number(createProductDto.regionId),
      districtId: Number(createProductDto.districtId),
      imageIndex: Number(createProductDto.imageIndex),
      propertyValues: properties || [], // propertyValues ni qo'shamiz
    });
    console.log('Yaratilgan mahsulot obyekti:', product);

    await this.productRepository.save(product);
    console.log('Mahsulot saqlandi.');

    return await this.productRepository.findOneOrFail({
      where: { id: product.id },
      relations: ['category', 'images', 'region', 'district'],
    });
  }
}
