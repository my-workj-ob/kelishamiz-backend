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
  DeleteResult,
  EntityNotFoundError,
  Equal,
  ILike,
  In,
  MoreThan,
  QueryFailedError,
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
    @InjectRepository(ProductProperty)
    private productPropertyRepository: Repository<ProductProperty>,
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>, // ← bu yerda!
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly fileService: FileService,
    private readonly uploadService: UploadService,
    @InjectRepository(ProductImage)
    private productImageRepository: Repository<ProductImage>,
    private dataSource: DataSource,
  ) {}

  async findAllPaginated(
    userId: number | null,
    page = 1,
    pageSize = 10,
    likedIds: number[] = [],
    isAdmin: boolean = false, // <-- Yangi parametr
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const skip = (page - 1) * pageSize;

    const whereCondition: any = {};
    if (!isAdmin) {
      whereCondition.isPublish = true; // Faqat ADMIN bo'lmaganda publish qilinganlarni ko'rsatish
    }

    const [products, total] = await this.productRepository.findAndCount({
      skip,
      take: pageSize,
      where: whereCondition, // <-- isPublish shartini shu yerga qo'ydik
      relations: [
        'category',
        'category.parent',
        'profile',
        'district',
        'images',
        'likes',
      ],
      order: { isTop: 'DESC', createdAt: 'DESC', images: { order: 'ASC' } },
    });

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

  async findById(
    id: number,
    isAdmin: boolean = false,
  ): Promise<Product | null> {
    // <-- Yangi parametr
    const where: any = { id };
    if (!isAdmin) {
      where.isPublish = true; // Faqat ADMIN bo'lmaganda publish qilingan bo'lishi kerak
    }

    return this.productRepository.findOne({
      where,
      relations: [
        'profile',
        'productProperties',
        'productProperties.property',
        'images',
        'category',
        'profile.user',
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
      .leftJoinAndSelect('category.parent', 'parentCategory') // <-- ota kategoriya qo‘shildi
      .leftJoinAndSelect('product.images', 'image')
      .where('profile.userId = :userId', { userId: id })
      .orderBy('image.order', 'ASC')
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
        .where('product.id IN (:...ids)', { ids: localLikedProductIds ?? [] })
        .orderBy('images.order', 'ASC')
        .getMany();

      const orderedProducts = (localLikedProductIds ?? [])
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => !!p);

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
      .where('product.id IN (:...ids)', { ids: finalLikedProductIds })
      .orderBy('images.order', 'ASC')
      .getMany();

    const orderedProducts = finalLikedProductIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);

    return orderedProducts;
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
    isAdmin: boolean = false, // <-- Yangi parametr
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
      negotiable,
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
      .leftJoinAndSelect('product.likes', 'likes');

    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', { categoryId });
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

    if (negotiable !== null && negotiable !== undefined) {
      queryBuilder.andWhere('product.negotiable = :negotiable', { negotiable });
    }

    if (districtId) {
      queryBuilder.andWhere('product.districtId = :districtId', { districtId });
    } else if (regionId) {
      queryBuilder.andWhere('districtRegion.id = :regionId', { regionId });
    }

    // ADMIN bo'lmasa, faqat o'z mahsulotlarini ko'rsatish shartini qo'shamiz
    if (ownProduct && userId) {
      queryBuilder.andWhere('product.profile.user.id = :userId', { userId }); // Foydalanuvchining ID'si bo'yicha
    }

    if (!isAdmin) {
      // Faqat ADMIN bo'lmaganda publish qilinganlarni ko'rsatish
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

    const product = this.productRepository.create({
      ...productData,
      category,
      profile: profile, // User emas, Profile obyektini bog'laymiz
      images: productImages,
      regionId: Number(createProductDto.regionId),
      districtId: Number(createProductDto.districtId),
      imageIndex: Number(createProductDto.imageIndex),
      propertyValues: properties || [],
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

  // NestJS service method: Fully rewritten updateProduct with circular reference fix

  async updateProduct(id: number, body: any, files?: Express.Multer.File[]) {
    this.logger.debug(`[updateProduct] Updating product ID: ${id}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.commitTransaction();
    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: ['images', 'productProperties', 'region', 'district'],
      });

      if (!product) throw new NotFoundException('Product not found');

      const uploadedUrls: string[] = [];
      const newFiles = files || [];

      // Fayllarni yuklash
      for (const file of newFiles) {
        const url = await this.uploadService.uploadFile(file);
        await this.fileService.saveFile(url);
        uploadedUrls.push(url);
      }

      // Rasmni qo‘shish
      body.images = Array.isArray(body.images) ? body.images : [];
      const maxOrder =
        product.images?.reduce((max, i) => Math.max(max, i.order ?? 0), 0) || 0;

      uploadedUrls.forEach((url, i) => {
        body.images.push({ url, order: maxOrder + i + 1 });
      });

      // Yangilanadigan maydonlar
      const toNumber = (val: any) =>
        typeof val === 'string' ? parseInt(val, 10) : val;

      const updatableFields = [
        'title',
        'description',
        'price',
        'minPrice',
        'maxPrice',
        'categoryId',
        'profileId',
        'regionId',
        'districtId',
        'paymentType',
        'currencyType',
        'negotiable',
        'ownProduct',
        'imageIndex',
        'isTop',
        'isPublish',
        'topExpiresAt',
      ];

      for (const key of updatableFields) {
        if (body[key] !== undefined) {
          product[key] = [
            'categoryId',
            'profileId',
            'regionId',
            'districtId',
            'imageIndex',
          ].includes(key)
            ? toNumber(body[key])
            : body[key];
        }
      }

      // Propertylarni yangilash
      if (Array.isArray(body.properties)) {
        await queryRunner.manager.delete(ProductProperty, {
          product: { id: product.id },
        });

        const propertyEntities: ProductProperty[] = [];

        for (const prop of body.properties) {
          const propertyId = parseInt(prop.propertyId, 10);
          const propertyEntity = await queryRunner.manager.findOne(Property, {
            where: { id: propertyId },
          });

          if (!propertyEntity) {
            this.logger.warn(
              `[updateProduct] Property topilmadi. ID: ${propertyId}`,
            );
            continue;
          }

          const productProperty = new ProductProperty();
          productProperty.product = product;
          productProperty.property = propertyEntity;
          productProperty.propertyId = propertyEntity.id;
          productProperty.productId = product.id;

          if (typeof prop.value === 'object' && prop.value !== null) {
            productProperty.value = prop.value;
          } else {
            this.logger.warn(
              `[updateProduct] Property ID ${propertyId} uchun noto'g'ri value format.`,
            );
            continue;
          }

          propertyEntities.push(productProperty);
        }

        await queryRunner.manager.save(propertyEntities);
        product.productProperties = propertyEntities;
      }

      // Eski rasmlarni olib tashlash
      const existingImages = await queryRunner.manager.find(ProductImage, {
        where: { product: { id: product.id } },
      });

      const incomingIds = body.images.filter((i) => i.id).map((i) => i.id);
      const toDelete = existingImages.filter(
        (i) => !incomingIds.includes(i.id),
      );

      for (const url of toDelete.map((i) => i.url)) {
        await this.fileService.deleteFileByUrl(url);
      }

      await queryRunner.manager.remove(toDelete);

      // Yangi va mavjud rasmlarni saqlash
      const updatedImages: ProductImage[] = [];
      let orderCounter = 1;
      for (const img of body.images) {
        if (img.id) {
          const existing = existingImages.find((i) => i.id === img.id);
          if (existing) {
            existing.url = img.url;
            existing.order = img.order ?? orderCounter++;
            updatedImages.push(existing);
          }
        } else {
          const newImg = new ProductImage();
          newImg.url = img.url;
          newImg.product = product;
          newImg.order = img.order ?? orderCounter++;
          updatedImages.push(newImg);
        }
      }

      await queryRunner.manager.save(updatedImages);
      product.images = updatedImages;

      // Yakuniy saqlash
      const savedProduct = await queryRunner.manager.save(product);

      // Circular reference oldini olish
      // for (const prop of savedProduct.productProperties) {
      //   delete (prop as any).product;
      // }

      // delete (savedProduct as any).district;
      // delete (savedProduct as any).region;
      await queryRunner.commitTransaction();

      return savedProduct;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Xato: ${err.message}`, err.stack);
      throw err instanceof HttpException
        ? err
        : new InternalServerErrorException(err.message);
    } finally {
      await queryRunner.release();
    }
  }
}
