/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
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
import { Product, } from './entities/product.entity';
import { FileService } from './../file/file.service';
import { UploadService } from './../file/uploadService';
import { ProductImage } from './entities/Product-Image.entity';

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
  ) { }

  async findAll() {
    return this.productRepository.find();
  }

  async findOne(id: number): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id },
      relations: ['profile', 'productProperties', 'productProperties.property'],
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
      .leftJoinAndSelect('district.region', 'region');

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
    createProductDto: ProductDto,
    userId: number,
    files: Express.Multer.File[], // Fayllarni qabul qilish
  ): Promise<Product> {
    const { categoryId, properties, images: imageDtos, ...productData } = createProductDto;
    console.log(userId);

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['properties'],
    });

    if (!category)
      throw new NotFoundException(`Kategoriya ${categoryId} topilmadi`);

    const user = await this.profileRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    if (!user) throw new NotFoundException(`Foydalanuvchi ${userId} topilmadi`);

    const productImages: ProductImage[] = [];
    if (imageDtos && files && files.length === imageDtos.length) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageDto = imageDtos[i];
        if (!file) {
          throw new BadRequestException(`Rasm fayli yuklanmagan`);
        }
        try {
          const vercelFileUrl = await this.uploadService.uploadFile(file);
          await this.fileService.saveFile(vercelFileUrl);
          const newProductImage = this.productImageRepository.create({ // Repository orqali yaratish
            url: vercelFileUrl,
            isMainImage: imageDto.isMainImage,
          });
          productImages.push(newProductImage);
        } catch (error) {
          throw new InternalServerErrorException(
            `Rasm yuklashda xatolik yuz berdi (${file.originalname})`,
            error,
          );
        }
      }
    } else if (imageDtos?.length > 0 || files?.length > 0) {
      throw new BadRequestException(
        'Rasm fayllari va ma’lumotlari mos kelmadi',
      );
    }

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
      images: productImages, // Yuklangan rasmlarni mahsulotga bog'lash
    });

    await this.productRepository.save(product);

    try {
      return await this.productRepository.findOneOrFail({
        where: { id: product.id },
        relations: ['category', 'productProperties.property', 'images'],
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
