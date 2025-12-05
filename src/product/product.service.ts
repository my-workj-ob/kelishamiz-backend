// src/product/product.service.ts
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  DeleteResult,
  In,
  MoreThan,
  Repository,
} from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Category } from '../category/entities/category.entity';
import { Property } from './../category/entities/property.entity';
import { Profile } from './../profile/enities/profile.entity';
import {
  ProductDto,
  PublishProductDto,
  TopProductDto,
} from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { ProductProperty } from './entities/product-property.entity';
import { Product } from './entities/product.entity';
import { FileService } from './../file/file.service';
import { UploadService } from './../file/uploadService';
import { ProductImage } from './entities/Product-Image.entity';
import { District } from 'src/location/entities/district.entity';
import { Region } from 'src/location/entities/region.entity';
import { instanceToPlain } from 'class-transformer';
import { UserViewedProduct } from './entities/product-view.entity';

import * as maxmind from 'maxmind';
import { RedisService } from './redis-service';
import { GeoIpService } from './geoip.service';
@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(UserViewedProduct)
    private productViewRepository: Repository<UserViewedProduct>, // ← bu yerda!
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly fileService: FileService,
    private readonly uploadService: UploadService,
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
    private dataSource: DataSource,

    private redisService: RedisService,
    private geoIpService: GeoIpService,
  ) {}

  /**
   * Barcha mahsulotlarni pagination, like holati, admin huquqlari
   * hamda region va tumanlar bo'yicha filtrlash bilan topadi.
   *
   * @param userId Mahsulotlarni like qilgan foydalanuvchi IDsi. Agar null bo'lsa, autentifikatsiya qilinmagan foydalanuvchi.
   * @param page Sahifa raqami.
   * @param pageSize Sahifadagi elementlar soni.
   * @param likedIds Autentifikatsiya qilinmagan foydalanuvchilar uchun "like" qilingan mahsulot ID'lari.
   * @param isAdmin Foydalanuvchi admin ekanligini bildiradi.
   * @param regionId Opsional region IDsi bo'yicha filtrlash.
   * @param districtIds Opsional tuman ID'lari massivi bo'yicha filtrlash (maksimal 3 ta).
   * @returns Paginated mahsulotlar ro'yxati va umumiy soni.
   */
  async findAllPaginated(
    userId: number | null,
    page = 1,
    pageSize = 10,
    likedIds: number[] = [],
    isAdmin: boolean = false,
    regionId?: number,
    districtIds: number[] = [],
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.logger.log(
      `Fetching paginated products: page=${page}, pageSize=${pageSize}, userId=${userId}, isAdmin=${isAdmin}, likedIds=${likedIds.join(',')}, regionId=${regionId}, districtIds=${districtIds.join(',')}`,
    );

    const skip = (page - 1) * pageSize;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('category.parent', 'parentCategory')
      .leftJoinAndSelect('product.profile', 'profile')
      .leftJoinAndSelect('profile.user', 'user')
      .leftJoinAndSelect('product.district', 'district')
      .leftJoinAndSelect('product.region', 'region')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.likes', 'likes')
      .orderBy('product.isTop', 'DESC')
      .addOrderBy('product.createdAt', 'DESC')
      .addOrderBy('images.order', 'ASC');

    const whereConditions: string[] = [];
    const parameters: { [key: string]: any } = {};

    if (!isAdmin) {
      whereConditions.push('product.isPublish = :isPublish');
      parameters.isPublish = true;
      this.logger.debug('Filtering for published products (non-admin user).');
    }

    if (regionId) {
      whereConditions.push('product.region.id = :regionId');
      parameters.regionId = regionId;
      this.logger.debug(`Filtering by regionId: ${regionId}`);
    }

    const effectiveDistrictIds = districtIds.slice(0, 3);

    if (effectiveDistrictIds.length > 0) {
      whereConditions.push('product.district.id IN (:...effectiveDistrictIds)');
      parameters.effectiveDistrictIds = effectiveDistrictIds;
      this.logger.debug(
        `Filtering by effectiveDistrictIds: ${effectiveDistrictIds.join(', ')}`,
      );
    } else if (regionId && effectiveDistrictIds.length === 0) {
      this.logger.debug('No districts selected, searching by region only.');
    }

    if (whereConditions.length > 0) {
      queryBuilder.where(whereConditions.join(' AND '), parameters);
    }

    const total = await queryBuilder.getCount();
    this.logger.debug(`Total products found (before pagination): ${total}`);

    const products = await queryBuilder.skip(skip).take(pageSize).getMany();
    this.logger.debug(`Found ${products.length} products after pagination.`);

    const result = products.map((product) => {
      let isLike: boolean = false;
      if (userId) {
        isLike = product.likes?.some((user) => user.id === userId) || false;
      } else {
        isLike = likedIds.includes(product.id);
      }
      return {
        ...product,
        isLike,
        profile: {
          ...product.profile,
          userId: product.profile.user?.id,
        },
      };
    });

    return {
      data: result,
      total,
      page,
      pageSize,
    };
  }

  async findAllTopPaginated(
    userId: number | null,
    page = 1,
    pageSize = 10,
    isAdmin: boolean = false, // <-- Yangi parametr
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;
    const now = new Date();
    const whereCondition: any = {
      isTop: true,
      topExpiresAt: MoreThan(now),
    };
    if (!isAdmin) {
      whereCondition.isPublish = true; // Faqat ADMIN bo'lmaganda publish qilingan top e'lonlar
    }

    const [products, total] = await this.productRepository.findAndCount({
      skip,
      take: pageSize,
      relations: ['category', 'profile', 'district', 'images', 'likes'],
      where: whereCondition, // <-- isPublish shartini shu yerga qo'ydik
      order: {
        topExpiresAt: 'DESC',
        createdAt: 'DESC',
        images: { order: 'ASC' },
      },
    });

    const result = products.map((product) => {
      let isLike = false;
      if (userId) {
        isLike = product.likes?.some((user) => user.id === userId) ?? false;
      }
      return {
        ...product,
        isLike,
      };
    });

    return {
      data: result,
      total,
      page,
      pageSize,
    };
  }

  parseUserAgent(ua: string) {
    const device = /mobile/i.test(ua) ? 'Mobile' : 'Desktop';
    const browser = /chrome/i.test(ua)
      ? 'Chrome'
      : /firefox/i.test(ua)
        ? 'Firefox'
        : /safari/i.test(ua)
          ? 'Safari'
          : 'Unknown';
    const os = /windows/i.test(ua)
      ? 'Windows'
      : /android/i.test(ua)
        ? 'Android'
        : /linux/i.test(ua)
          ? 'Linux'
          : /iphone|ios/i.test(ua)
            ? 'iOS'
            : 'Unknown';

    return { device, browser, os };
  }

  isBot(userAgent: string): boolean {
    const bots = [
      'Googlebot',
      'Bingbot',
      'Slurp',
      'DuckDuckBot',
      'Baiduspider',
      'YandexBot',
      'Sogou',
      'facebot',
      'ia_archiver',
    ];

    return bots.some((bot) => userAgent?.includes(bot));
  }

  async incrementViewCount(
    productId: number,
    userId: number | null,
    ip: string | null,
    userAgent: string | null,
    utm?: string | null,
  ): Promise<boolean> {
    if (!userAgent || this.isBot(userAgent)) return false;

    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['profile', 'profile.user'],
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (userId && product.profile?.user?.id === userId) return false;

    const lockKey = `product_view_lock:${productId}:${userId ?? ip ?? 'anon'}`;
    const lockAcquired = await this.redisService.acquireLock(lockKey, 2000);
    if (!lockAcquired) return false;

    try {
      const now = new Date();
      const parsed = this.parseUserAgent(userAgent);

      // Tekshirish: oxirgi view
      const lastView = await this.productViewRepository.findOne({
        where: userId
          ? { product: { id: productId }, user: { id: userId } }
          : { product: { id: productId }, ip: ip ?? undefined, userAgent },
        order: { viewedAt: 'DESC' },
      });

      if (lastView) {
        const diffMs = now.getTime() - lastView.viewedAt.getTime();
        if (diffMs < 60 * 60 * 1000) return false;
        if (!userId && diffMs < 24 * 60 * 60 * 1000) return false;
      }

      // QueryBuilder bilan insert
      await this.productViewRepository
        .createQueryBuilder()
        .insert()
        .into('user_viewed_product')
        .values({
          product: { id: productId } as any, // relation uchun as any
          user: userId ? { id: userId } : null,
          ip: ip ?? undefined,
          userAgent: userAgent ?? undefined,
          device: parsed.device,
          browser: parsed.browser,
          os: parsed.os,
          country:
            this.geoIpService.getCountryByIp(ip ?? undefined) ?? undefined,
          utm: utm ?? undefined,
          viewedAt: now,
        })
        .execute();

      await this.productRepository.increment({ id: productId }, 'viewCount', 1);

      return true;
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }

  async findById(
    id: number,
    isAdmin: boolean = false,
  ): Promise<Product | null> {
    const where: any = { id };
    if (!isAdmin) {
      where.isPublish = true;
    }

    const product = await this.productRepository.findOne({
      where,
      relations: [
        'profile',
        'profile.user',
        'productProperties',
        'productProperties.property',
        'images',
        'category',
      ],
    });

    if (!product) {
      return null;
    }

    if (product.profile && product.profile.user) {
      (product.profile as any).userId = product.profile.user.id;
    }

    const formattedProperties = product.productProperties.map((p) => ({
      type: p.type,
      value: {
        key: p.property?.name || `property_${p.propertyId}`,
        value: p.value,
      },
      propertyId: p.propertyId,
    }));

    const result = {
      ...product,
      profile: {
        ...product.profile,
        userId: product.profile?.user?.id,
      },
      productProperties: product.productProperties,
    };

    delete (result.profile as any).user;

    return result as any;
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

  async getFullTextSearchByCategory(
    query: string,
    categoryId: number,
    location?: string,
    isAdmin: boolean = false,
  ): Promise<Product[]> {
    try {
      const qb = this.productRepository.createQueryBuilder('product');

      qb.addSelect('SIMILARITY(product.title, :query)', 'title_similarity')
        .addSelect('SIMILARITY(product.description, :query)', 'desc_similarity')
        .setParameter('query', query);

      qb.orderBy('title_similarity', 'DESC').addOrderBy(
        'desc_similarity',
        'DESC',
      );

      const words = query.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        throw new NotFoundException('Qidiruv so‘zi bo‘sh');
      }

      const queryString = words.join(' ');

      qb.where(
        '(product.title % :queryString OR product.description % :queryString)',
        { queryString },
      );

      qb.andWhere('product.categoryId = :categoryId', { categoryId });

      if (!isAdmin) {
        qb.andWhere('product.isPublish = :isPublish', { isPublish: true }); // Faqat ADMIN bo'lmaganda publish qilinganlarni tekshirish
      }

      if (location) {
        qb.andWhere('LOWER(product.location) ILIKE LOWER(:location)', {
          location: `%${location}%`,
        });
      }

      qb.leftJoinAndSelect('product.profile', 'profile')
        .leftJoinAndSelect('product.productProperties', 'productProperties')
        .leftJoinAndSelect('productProperties.property', 'property')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoinAndSelect('product.images', 'images')
        .leftJoinAndSelect('product.region', 'region') // to‘g‘ri yozilgan
        .leftJoinAndSelect('product.district', 'district') // to‘g‘ri yozilgan
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
    isAdmin: boolean = false, // <-- Yangi parametr
  ): Promise<Product[]> {
    if (!title || !categoryId) {
      throw new NotFoundException('title va categoryId talab qilinadi');
    }

    const product = await this.findOne(title, categoryId); // findOne metodi isPublish ni tekshirmaydi

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi');
    }

    // Agar product topilsa, lekin u publish qilinmagan bo'lsa va bu admin bo'lmasa, uni qaytarmaymiz.
    // getFullTextSearchByCategory ichida isPublish tekshiruvi bor.
    const combinedQuery = `${product.title} ${product.description || ''}`;

    return this.getFullTextSearchByCategory(
      combinedQuery.trim(),
      categoryId,
      undefined,
      isAdmin,
    );
  }
  async getUserProducts(id: number): Promise<Profile | null> {
    const profile = await this.profileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.products', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.region', 'region')
      .leftJoinAndSelect('product.district', 'district')
      .leftJoinAndSelect('category.parent', 'parentCategory')
      .leftJoinAndSelect('product.images', 'image') // alias: image
      .where('profile.userId = :userId', { userId: id })
      .andWhere('product.isPublish = :isPublish', { isPublish: true })
      .orderBy('product.updatedAt', 'DESC') // 1. updatedAt bo‘yicha yangi mahsulotlar
      .addOrderBy('product.createdAt', 'DESC') // 2. createdAt bo‘yicha
      .addOrderBy('image.order', 'ASC') // 3. rasmlar tartibi (to‘g‘ri alias ishlatildi)
      .getOne();

    return profile;
  }

  async syncLikesFromLocal(
    userId: number | null,
    localLikedProductIds?: number[],
  ) {
    // 1. Mehmon foydalanuvchi bo‘lsa, faqat localLikedProductIds asosida qaytaramiz
    if (!userId) {
      const products = await this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .leftJoinAndSelect('product.images', 'images')
        .leftJoinAndSelect('product.likes', 'likes')
        .leftJoinAndSelect('product.profile', 'profile')
        .leftJoinAndSelect('product.region', 'region')
        .leftJoinAndSelect('product.district', 'district')
        .where('product.id IN (:...ids)', { ids: localLikedProductIds ?? [] })
        .orderBy('images.order', 'ASC')
        .getMany();

      const orderedProducts = (localLikedProductIds ?? [])
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p);
      console.log(orderedProducts);

      return orderedProducts;
    }

    // 2. Foydalanuvchi topiladi
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['likes', 'profile'],
    });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const alreadyLikedProductIds = user.likes?.map((p) => p.id) || [];

    const newProductIdsToLike =
      localLikedProductIds?.filter(
        (id) => !alreadyLikedProductIds.includes(id),
      ) ?? [];

    if (newProductIdsToLike.length > 0) {
      const productsToLike = await this.productRepository.find({
        where: { id: In(newProductIdsToLike) },
        relations: ['likes'],
      });

      for (const product of productsToLike) {
        if (!product.likes) {
          product.likes = [];
        }

        product.likes.push(user);
        product.likesCount = (product.likesCount || 0) + 1;
      }

      await this.productRepository.save(productsToLike);

      user.likes = [...user.likes, ...productsToLike];
      await this.userRepository.save(user);
    }

    const finalLikedProductIds = [
      ...alreadyLikedProductIds,
      ...newProductIdsToLike,
    ];

    const products = await this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.likes', 'likes')
      .leftJoinAndSelect('product.profile', 'profile')
      .leftJoinAndSelect('product.region', 'region')
      .leftJoinAndSelect('product.district', 'district')
      .where('product.id IN (:...ids)', { ids: finalLikedProductIds })
      .orderBy('images.order', 'ASC')
      .getMany();

    const orderedProducts = finalLikedProductIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);

    return orderedProducts;
  }

  // Service metod
  async getUserProductsByPublishedStatus(userId: number) {
    return this.productRepository.find({
      where: {
        profile: { user: { id: userId } },
        isPublish: false,
      },
      relations: ['images', 'likes', 'category', 'region', 'district'],
      order: { createdAt: 'DESC' },
    });
  }

  async toggleLike(projectId: number, userId: number): Promise<boolean> {
    const project = await this.productRepository.findOne({
      where: { id: projectId },
      relations: ['likes', 'images'],
    });

    if (!project) {
      throw new NotFoundException('Product not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasLiked = project.likes.some((likeUser) => likeUser.id === userId);

    if (hasLiked) {
      project.likes = project.likes.filter(
        (likeUser) => likeUser.id !== userId,
      );
      project.likesCount -= 1;
    } else {
      project.likes.push(user);
      project.likesCount += 1;
    }

    await this.productRepository.save(project);
    return !hasLiked;
  }

  async checkLikeStatus(projectId: number, userId: number): Promise<boolean> {
    const project = await this.productRepository.findOne({
      where: { id: projectId },
      relations: ['likes'],
    });

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

  async filter(
    filters: GetProductsDto,
    userId?: number,
    likedIds: number[] = [],
    isAdmin: boolean = false,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      categoryId,
      minPrice,
      maxPrice,
      title,
      ownProduct,
      properties,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      paymentType,
      currencyType,
      regionId,
      districtId,
      page = 1,
      pageSize = 10,
      ...otherFilters
    } = filters;

    const queryBuilder = this.productRepository.createQueryBuilder('product');

    queryBuilder
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.profile', 'profile')
      .leftJoinAndSelect('product.district', 'district')
      .leftJoin('district.region', 'districtRegion')
      .leftJoinAndSelect('product.region', 'productRegion')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.likes', 'likes')
      .addOrderBy('images.order', 'ASC')
      .addOrderBy('images.images.id', 'DESC');
    if (categoryId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: categoryId },
        relations: ['children'],
      });

      const categoryIds = [categoryId];
      if (parentCategory?.children?.length) {
        categoryIds.push(...parentCategory.children.map((c) => c.id));
      }

      queryBuilder.andWhere('product.categoryId IN (:...categoryIds)', {
        categoryIds,
      });
    }

    if (minPrice !== null && minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== null && maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (title && title.trim()) {
      queryBuilder.andWhere('product.title ILIKE :title', {
        title: `%${title.trim()}%`,
      });
    }

    if (paymentType) {
      queryBuilder.andWhere('product.paymentType = :paymentType', {
        paymentType,
      });
    }

    if (currencyType) {
      queryBuilder.andWhere('product.currencyType = :currencyType', {
        currencyType,
      });
    }

    if (districtId) {
      if (
        Array.isArray(districtId) &&
        districtId.length > 0 &&
        districtId.length <= 3
      ) {
        queryBuilder.andWhere('product.districtId IN (:...districtIds)', {
          districtIds: districtId,
        });
      } else if (typeof districtId === 'number') {
        queryBuilder.andWhere('product.districtId = :districtId', {
          districtId,
        });
      }
    }

    if (ownProduct && userId) {
    }

    if (!isAdmin) {
      queryBuilder.andWhere('product.isPublish = :isPublish', {
        isPublish: true,
      });
    }

    if (properties && Array.isArray(properties) && properties.length > 0) {
      properties.forEach((prop, index) => {
        const key = `propertyKey${index}`;
        const value = `propertyValue${index}`;
        queryBuilder.andWhere(`product.properties ->> :${key} = :${value}`, {
          [key]: prop.key,
          [value]: prop.value,
        });
      });
    }

    const allowedSortFields = ['price', 'createdAt', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';
    const safeSortOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(`product.${safeSortBy}`, safeSortOrder);

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    queryBuilder.skip(skip).take(take);

    const [products, total] = await queryBuilder.getManyAndCount();

    const result = products.map((product) => {
      let isLike = false;

      if (userId) {
        isLike = product.likes?.some((user) => user.id === userId) ?? false;
      } else if (likedIds.length > 0) {
        isLike = likedIds.includes(product.id);
      }

      return {
        ...product,
        isLike,
      };
    });

    return {
      data: result,
      total,
      page,
      pageSize: take,
    };
  }

  async create(
    files: Express.Multer.File[],
    createProductDto: Omit<ProductDto, 'images'>,
    userId: number,
  ): Promise<Product> {
    console.log('BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN);
    const { categoryId, properties, ...productData } = createProductDto;
    console.log('files:', files);
    console.log('createProductDto:', createProductDto);

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException(`Kategoriya topilmadi`);
    console.log('Topilgan kategoriya:', category);

    // Profile orqali userni topish, chunki product profilega bog'langan
    const profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile)
      throw new NotFoundException(`Foydalanuvchi profili topilmadi`);

    const productImages: ProductImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const vercelFileUrl = await this.uploadService.uploadFile(file);
        await this.fileService.saveFile(vercelFileUrl);

        const newProductImage = this.productImageRepository.create({
          url: vercelFileUrl,
          order: i,
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
    const formattedProperties = (createProductDto.properties || []).map(
      (p: any) => ({
        type: p.type,
        value: {
          key: p.key ?? '', // agar key mavjud bo'lmasa bo'sh string
          value: p.value ?? '', // value ham bo'sh bo'lsa bo'sh string
        },
        propertyId: Number(p.propertyId), // propertyId ni raqamga o'tkazish
      }),
    );

    const product = this.productRepository.create({
      ...productData,
      category,
      profile: profile, // User emas, Profile obyektini bog'laymiz
      images: productImages,
      regionId: Number(createProductDto.regionId),
      districtId: Number(createProductDto.districtId),
      imageIndex: Number(createProductDto.imageIndex),
      propertyValues: formattedProperties || [],
      isPublish: createProductDto.isPublish ?? false, // isPublish shu yerda keladi
    });
    console.log('Yaratilgan mahsulot obyekti:', product);

    await this.productRepository.save(product);
    console.log('Mahsulot saqlandi.');

    return await this.productRepository.findOneOrFail({
      where: { id: product.id },
      relations: ['category', 'images', 'region', 'district'],
    });
  }

  async deleteOneById(productId: number): Promise<DeleteResult> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['profile', 'images', 'chatRooms', 'likes'],
    });

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi');
    }

    // Rasmlarni Vercel Blob dan o'chirish (ixtiyoriy, lekin tavsiya etiladi)
    // for (const image of product.images) {
    //   try {
    //     await this.uploadService.deleteFile(image.url); // deleteFile metodi mavjud deb faraz qilyapmiz
    //     await this.fileService.deleteFile(image.url); // DB dan ham o'chirish
    //   } catch (error) {
    //     console.warn(
    //       `Rasm o'chirishda xatolik: ${image.url}, ${error.message}`,
    //     );
    //   }
    // }

    return await this.productRepository.delete(productId);
  }

  async updateTopStatus(
    id: number,
    topData: TopProductDto,
    isAdmin: boolean,
  ): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');

    if (topData.isPublish !== undefined && !isAdmin) {
      throw new BadRequestException(
        'Sizning isPublish statusini o`zgartirishga ruxsatingiz yo`q.',
      );
    }

    // Agar isPublish ni o'zgartirish so'ralgan bo'lsa (faqat adminlar uchun)
    if (product.isPublish !== undefined) {
      product.isPublish = topData.isPublish ?? product.isPublish;
    }

    // Agar top qilish istalgan bo‘lsa, lekin publish bo‘lmasa — error
    // Bu tekshiruv hozir ham o'rinli, chunki top bo'lmagan mahsulot published bo'lishi shart
    if (topData.isTop && !product.isPublish) {
      throw new BadRequestException(
        'Top statusini faqat publish bo‘lgan mahsulotlarga qo`llash mumkin.',
      );
    }

    if (topData.isTop !== undefined) {
      product.isTop = topData.isTop;
    }

    if (topData.topExpiresAt) {
      product.topExpiresAt = new Date(topData.topExpiresAt);
    } else if (topData.isTop === false) {
      // Agar isTop false bo'lsa, topExpiresAt ni null qilish
      product.topExpiresAt = null;
    }

    return this.productRepository.save(product);
  }
  async updatePublish(
    id: number,
    isPublish: PublishProductDto,
    isAdmin: boolean,
  ): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) throw new NotFoundException('Product not found');

    // Agar isPublish ni o'zgartirish so'ralgan bo'lsa va bu admin bo'lmasa, ruxsat bermaslik
    if (isPublish.isPublish !== undefined && !isAdmin) {
      throw new BadRequestException(
        'Sizning isPublish statusini o`zgartirishga ruxsatingiz yo`q.',
      );
    }

    if (isPublish.isPublish !== undefined) {
      product.isPublish = isPublish.isPublish;
    }

    return this.productRepository.save(product);
  }

  async updateProduct(
    id: number,
    body: any,
    files?: Express.Multer.File[],
  ): Promise<any> {
    this.logger.debug(`[updateProduct] Starting product update. ID: ${id}`);

    const toNumber = (val: any) =>
      typeof val === 'string' ? parseInt(val, 10) : val;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: [
          'images',
          'productProperties',
          'productProperties.property',
          'region',
          'district',
        ],
      });

      if (!product) {
        this.logger.warn(`[updateProduct] Product not found. ID: ${id}`);
        throw new NotFoundException('Product not found');
      }

      const updatableFields = [
        'title',
        'description',
        'price',
        'minPrice',
        'maxPrice',
        'categoryId',
        'profileId',
        'paymentType',
        'currencyType',
        'negotiable',
        'ownProduct',
        'isTop',
        'isPublish',
        'topExpiresAt',
      ];

      for (const key of updatableFields) {
        if (body[key] !== undefined) {
          product[key] = ['categoryId', 'profileId'].includes(key)
            ? toNumber(body[key])
            : body[key];
          this.logger.debug(
            `[updateProduct] Field ${key} set to ${product[key]}`,
          );
        }
      }

      // Region
      if (body.regionId !== undefined) {
        const regionId = toNumber(body.regionId);
        const region = await queryRunner.manager.findOne(Region, {
          where: { id: regionId },
        });
        if (!region) throw new NotFoundException('Region not found');
        product.region = region;
        product.regionId = region.id;
      }

      // District
      if (body.districtId !== undefined) {
        const districtId = toNumber(body.districtId);
        const district = await queryRunner.manager.findOne(District, {
          where: { id: districtId },
        });
        if (!district) throw new NotFoundException('District not found');
        product.district = district;
        product.districtId = district.id;
      }

      // Product properties tozalash (clear product properties)
      await queryRunner.manager.delete(ProductProperty, {
        product: { id: product.id },
      });

      let productProperties: ProductProperty[] = [];
      let propertyValues: Array<{
        type: string;
        value: { key: string; value: string } | any;
        propertyId: string;
      }> = [];

      if (body.properties) {
        if (typeof body.properties === 'string') {
          try {
            body.properties = JSON.parse(body.properties);
          } catch {
            throw new BadRequestException('Invalid JSON format for properties');
          }
        }

        if (Array.isArray(body.properties)) {
          for (const prop of body.properties) {
            const key = prop.value?.key;
            const value = prop.value?.value;

            propertyValues.push({
              type: prop.type,
              value: key && value !== undefined ? { key, value } : prop.value,
              propertyId: prop.propertyId,
            });

            const pp = new ProductProperty();
            pp.propertyId = Number(prop.propertyId);
            pp.type = prop.type;
            pp.value = prop.value;
            pp.product = product;

            productProperties.push(pp);
          }
        }
      }

      product.propertyValues = propertyValues;
      product.productProperties = productProperties;

      // Rasmlarni qayta ishlash (process images)
      this.logger.debug(`[updateProduct] Processing images...`);

      const existingImages = await queryRunner.manager.find(ProductImage, {
        where: { product: { id: product.id } },
        order: { order: 'ASC', id: 'DESC' },
      });

      const bodyImages = Array.isArray(body.images) ? body.images : [];

      // Tartiblash uchun order tayyorlash (prepare order for sorting)
      const sortedBodyImages = bodyImages
        .map((img: any, index: number) => ({
          ...img,
          order: isNaN(toNumber(img.order)) ? index : toNumber(img.order),
        }))
        .sort((a, b) => a.order - b.order);

      const imageIds = new Set(sortedBodyImages.map((img: any) => img.id));

      // Keraksiz rasmlarni o‘chirish (delete unnecessary images)
      const imagesToDelete = existingImages.filter(
        (img) => !imageIds.has(img.id),
      );
      for (const img of imagesToDelete) {
        try {
          await this.fileService.deleteFileByUrl(img.url);
          this.logger.debug(`[updateProduct] Deleted image file: ${img.url}`);
        } catch (err) {
          this.logger.warn(
            `[updateProduct] Failed to delete file: ${img.url}, Error: ${err.message}`,
          );
        }
      }
      await queryRunner.manager.remove(imagesToDelete);

      // Rasm saqlash uchun massiv (array for saving images)
      const imagesToSave: ProductImage[] = [];

      for (const img of sortedBodyImages) {
        const existing = existingImages.find((e) => e.id === img.id);
        const newImg = existing ? existing : new ProductImage();
        newImg.url = img.url;
        newImg.order = img.order;
        newImg.product = product;
        imagesToSave.push(newImg);
        this.logger.debug(`[updateProduct] Prepared image: ${newImg.url}`);
      }

      // Yangi fayllar qo‘shish (oxiriga tartib bilan) (add new files with order at the end)
      let maxOrder = imagesToSave.length;
      if (files?.length) {
        for (const file of files) {
          const url = await this.uploadService.uploadFile(file);
          await this.fileService.saveFile(url); // This line might be redundant if uploadFile already saves, or it could be for internal tracking. Adjust as per your FileService implementation.
          const newImg = new ProductImage();
          newImg.url = url;
          newImg.product = product;
          newImg.order = maxOrder++; // navbatdagi tartib (next order)
          imagesToSave.push(newImg);
          this.logger.debug(`[updateProduct] Uploaded new image: ${url}`);
        }
      }

      if (imagesToSave.length > 10) {
        throw new BadRequestException('Rasmlar soni 10 tadan oshmasligi kerak'); // Number of images should not exceed 10
      }

      await queryRunner.manager.save(imagesToSave);
      product.images = imagesToSave;

      // Asosiy rasm imageIndex dan aniqlanadi (main image is determined by imageIndex)
      const imgIndex = toNumber(body.imageIndex);
      product.imageIndex =
        !isNaN(imgIndex) && imgIndex >= 0 && imgIndex < product.images.length
          ? imgIndex
          : product.images.length > 0
            ? 0
            : -1;

      // Mahsulotni saqlash (save product)
      const savedProduct = await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();

      this.logger.debug(`[updateProduct] Product update committed. ID: ${id}`);

      return instanceToPlain(savedProduct, {
        excludeExtraneousValues: true,
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[updateProduct] Error: ${err.message}, ${err.stack}`);
      throw err instanceof HttpException
        ? err
        : new InternalServerErrorException('Unexpected error occurred.');
    } finally {
      await queryRunner.release();
      this.logger.debug(`[updateProduct] QueryRunner released.`);
    }
  }
}
