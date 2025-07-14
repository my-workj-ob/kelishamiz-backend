// src/product/product.service.ts
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
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

  async updateProduct(id: number, body: any, files?: Express.Multer.File[]) {
    this.logger.debug(
      `[updateProduct] Mahsulotni yangilash boshlandi. ID: ${id}, Body: ${JSON.stringify(body)}, Files count: ${files?.length || 0}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug(
        `[updateProduct] Mahsulotni ID: ${id} bo'yicha qidirilmoqda...`,
      );

      const found = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: ['images', 'productProperties'],
      });

      if (!found) {
        this.logger.warn(`[updateProduct] Mahsulot topilmadi. ID: ${id}`);
        throw new NotFoundException('Product not found');
      }

      const product = found; // endi bu `Product`, null emas
      this.logger.debug(`[updateProduct] Mahsulot topildi. ID: ${product.id}`);
      if (!product) {
        this.logger.warn(`[updateProduct] Mahsulot topilmadi. ID: ${id}`);
        throw new NotFoundException('Product not found');
      }
      this.logger.debug(`[updateProduct] Mahsulot topildi. ID: ${product.id}`);

      // 2. Incoming images tahlili
      const incomingImages = Array.isArray(body.images) ? body.images : [];

      const oldImages = incomingImages.filter((img) => img.id);
      const urlImages = incomingImages.filter(
        (img) => !img.id && typeof img.url === 'string',
      );
      const newFiles = files || [];
      this.logger.debug(
        `[updateProduct] Incoming images tahlili: Old images: ${oldImages.length}, URL images: ${urlImages.length}, New files: ${newFiles.length}`,
      );

      // 3. Rasmlar sonini cheklash (max 10 ta)
      const totalImageCount =
        oldImages.length + urlImages.length + newFiles.length;
      this.logger.debug(`[updateProduct] Jami rasm soni: ${totalImageCount}`);
      if (totalImageCount > 10) {
        this.logger.warn(
          `[updateProduct] Rasmlar soni cheklovdan oshib ketdi (${totalImageCount} > 10).`,
        );
        throw new BadRequestException('Rasmlar soni 10 tadan oshmasligi kerak');
      }

      // 4. Yangi fayllarni yuklash
      const uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        this.logger.debug(
          `[updateProduct] Yangi fayllarni yuklash boshlandi. Fayllar soni: ${newFiles.length}`,
        );
        for (const file of newFiles) {
          try {
            const url = await this.uploadService.uploadFile(file);
            await this.fileService.saveFile(url);
            uploadedUrls.push(url);
            this.logger.debug(
              `[updateProduct] Fayl muvaffaqiyatli yuklandi: ${url}`,
            );
          } catch (uploadError) {
            this.logger.error(
              `[updateProduct] Faylni yuklashda xato yuz berdi: ${file.originalname}. Xato: ${uploadError.message}`,
              uploadError.stack,
            );
            throw new InternalServerErrorException(
              `Faylni yuklashda xato yuz berdi: ${file.originalname}. Iltimos, keyinroq urinib ko'ring.`,
            );
          }
        }
        this.logger.debug(
          `[updateProduct] Barcha yangi fayllar yuklandi. Yuklangan URL'lar soni: ${uploadedUrls.length}`,
        );
      } else {
        this.logger.debug(`[updateProduct] Yangi fayllar mavjud emas.`);
      }

      // 5. Uploaded URL'larni body.images ga qo'shish
      if (!Array.isArray(body.images)) {
        body.images = [];
        this.logger.debug(
          `[updateProduct] body.images mavjud emas edi, yangi bo'sh array yaratildi.`,
        );
      }

      // `order` qiymatlari uchun maksimal qiymatni topish
      const currentMaxOrder =
        product.images && product.images.length > 0
          ? Math.max(...product.images.map((img) => img.order ?? 0))
          : 0;
      this.logger.debug(
        `[updateProduct] Mavjud rasmlar orasida maksimal order: ${currentMaxOrder}`,
      );

      uploadedUrls.forEach((url, index) => {
        body.images.push({
          url,
          order: currentMaxOrder + index + 1, // Yangi rasmlarga ketma-ket order berish
        });
        this.logger.debug(
          `[updateProduct] Yangi yuklangan URL body.images ga qo'shildi: ${url}, Order: ${currentMaxOrder + index + 1}`,
        );
      });

      // 6. Mahsulotning boshqa maydonlarini update qilish
      this.logger.debug(
        `[updateProduct] Mahsulotning boshqa maydonlarini yangilash...`,
      );
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
        'imageIndex', // imageIndex ni saqlab qolamiz va u asosiy rasmni belgilaydi
        'isTop',
        'isPublish',
        'topExpiresAt',
      ];
      for (const key of updatableFields) {
        if (body[key] !== undefined) {
          product[key] = body[key];
          this.logger.debug(
            `[updateProduct] Maydon '${key}' yangilandi. Yangi qiymat: ${body[key]}`,
          );
        }
      }
      this.logger.debug(
        `[updateProduct] Mahsulotning asosiy maydonlari yangilandi.`,
      );

      // 7. propertyValues yangilash
      if (body.properties && Array.isArray(body.properties)) {
        this.logger.debug(
          `[updateProduct] 'body.properties' arrayini qayta ishlash boshlandi.`,
        );
        const constructedPropertyValues: {
          [key: string]: Record<string, string>;
        } = {};

        for (const prop of body.properties) {
          if (!prop.propertyId) {
            this.logger.warn(
              `[updateProduct] PropertyId topilmadi, o'tkazib yuborildi: ${JSON.stringify(prop)}`,
            );
            continue;
          }
          let propertyEntity: Property | null;
          try {
            propertyEntity = await this.propertyRepository.findOne({
              where: { id: prop.propertyId },
            });

            if (!propertyEntity) {
              this.logger.warn(
                `[updateProduct] Property topilmadi: ID ${prop.propertyId}.`,
              );
              throw new NotFoundException(
                `Property topilmadi: ID ${prop.propertyId}`,
              );
            }
          } catch (error) {
            this.logger.error(
              `[updateProduct] Property ID: ${prop.propertyId} bo'yicha topishda xato: ${error.message}`,
              error.stack,
            );
            throw new InternalServerErrorException(
              `Xususiyatni topishda xato yuz berdi: ID ${prop.propertyId}`,
            );
          }

          if (!propertyEntity) {
            this.logger.warn(
              `[updateProduct] Property ID: ${prop.propertyId} bazada topilmadi. O'tkazib yuborildi.`,
            );
            continue;
          }

          let propertyValue: Record<string, string>;
          if (typeof prop.value === 'object' && prop.value !== null) {
            propertyValue = prop.value;
          } else if (prop.value !== undefined && prop.value !== null) {
            propertyValue = { value: String(prop.value) };
            this.logger.debug(
              `[updateProduct] Property '${propertyEntity.name}' uchun oddiy qiymat ob'ektga o'raldi: ${JSON.stringify(propertyValue)}`,
            );
          } else {
            this.logger.warn(
              `[updateProduct] Property '${propertyEntity.name}' uchun qiymat mavjud emas yoki noto'g'ri turda. O'tkazib yuborildi.`,
            );
            continue;
          }

          constructedPropertyValues[propertyEntity.name] = propertyValue;
        }
        body.propertyValues = constructedPropertyValues;
        this.logger.debug(
          `[updateProduct] body.propertyValues konstruksiya qilindi: ${JSON.stringify(body.propertyValues)}`,
        );
      } else if (body.propertyValues) {
        this.logger.debug(
          `[updateProduct] 'body.propertyValues' to'g'ridan-to'g'ri ishlatilmoqda.`,
        );
      } else {
        this.logger.debug(
          `[updateProduct] 'body.properties' yoki 'body.propertyValues' mavjud emas.`,
        );
      }

      if (body.propertyValues) {
        if (
          typeof body.propertyValues !== 'object' ||
          body.propertyValues === null
        ) {
          this.logger.warn(
            `[updateProduct] 'propertyValues' uchun noto'g'ri tur aniqlandi (tekshiruvdan keyin ham). Kutilgan: object. Kelgan: ${typeof body.propertyValues}`,
          );
          throw new BadRequestException(
            'Invalid type for propertyValues. Expected an object.',
          );
        }

        this.logger.debug(
          `[updateProduct] 'propertyValues' yangilash boshlandi.`,
        );
        // Eski propertylarni o'chirish
        this.logger.debug(
          `[updateProduct] Mahsulotga tegishli eski propertylarni o'chirish...`,
        );
        await queryRunner.manager.delete(ProductProperty, {
          product: { id: product.id },
        });
        this.logger.debug(`[updateProduct] Eski propertylar o'chirildi.`);

        const newProperties: ProductProperty[] = [];
        for (const [propertyName, value] of Object.entries(
          body.propertyValues,
        )) {
          this.logger.debug(
            `[updateProduct] '${propertyName}' propertyni qayta ishlash.`,
          );

          let property: Property | null;
          try {
            property = await queryRunner.manager.findOne(Property, {
              where: {
                name: propertyName,
                category: { id: product.categoryId },
              },
            });
          } catch (error) {
            this.logger.error(
              `[updateProduct] Property '${propertyName}' ni topishda xato: ${error.message}`,
              error.stack,
            );
            throw new InternalServerErrorException(
              `'${propertyName}' xususiyatini topishda xato yuz berdi.`,
            );
          }

          if (!property) {
            this.logger.warn(
              `[updateProduct] Property topilmadi: ${propertyName}. Ushbu property o'tkazib yuboriladi.`,
            );
            continue; // keyingi iteratsiyaga o'tadi
          }

          if (!property) {
            this.logger.warn(
              `[updateProduct] Property topilmadi: ${propertyName}. Ushbu property o'tkazib yuboriladi.`,
            );
            continue;
          }
          this.logger.debug(
            `[updateProduct] Property topildi: ${property.name} (ID: ${property.id})`,
          );

          const productProperty = new ProductProperty();
          productProperty.product = product;
          productProperty.productId = product.id;
          productProperty.property = property;
          productProperty.propertyId = property.id;

          if (typeof value === 'object' && value !== null) {
            productProperty.value = value as Record<string, string>;
            this.logger.debug(
              `[updateProduct] Property value tayinlandi: ${JSON.stringify(value)}`,
            );
          } else {
            this.logger.error(
              `[updateProduct] Property '${propertyName}' uchun noto'g'ri qiymat turi: ${typeof value}. Kutilgan: object.`,
            );
            throw new BadRequestException(
              `Invalid value type for property: ${propertyName}. Expected an object.`,
            );
          }

          newProperties.push(productProperty);
        }

        if (newProperties.length > 0) {
          this.logger.debug(
            `[updateProduct] Yangi propertylarni bazaga saqlash. Son: ${newProperties.length}`,
          );
          await queryRunner.manager.save(newProperties);
          this.logger.debug(`[updateProduct] Yangi propertylar saqlandi.`);
        } else {
          this.logger.debug(
            `[updateProduct] Saqlash uchun yangi propertylar mavjud emas.`,
          );
        }
        product.productProperties = newProperties;
        this.logger.debug(
          `[updateProduct] 'propertyValues' yangilanishi yakunlandi.`,
        );
      } else {
        this.logger.debug(
          `[updateProduct] 'body.propertyValues' mavjud emas yoki array emas, propertylar yangilanmadi.`,
        );
      }

      // 8. Rasmlarni yangilash: eski rasmlarni o'chirish + yangi rasmlarni saqlash
      if (body.images && Array.isArray(body.images)) {
        this.logger.debug(
          `[updateProduct] Rasmlarni yangilash jarayoni boshlandi.`,
        );
        const updatedImages: ProductImage[] = [];
        const existingImages = await queryRunner.manager.find(ProductImage, {
          where: { product: { id: product.id } },
        });
        this.logger.debug(
          `[updateProduct] Mavjud rasmlar soni: ${existingImages.length}`,
        );

        const incomingIds = body.images
          .filter((img) => img.id)
          .map((img) => img.id);
        this.logger.debug(
          `[updateProduct] Incoming IDs: ${incomingIds.join(', ')}`,
        );

        const imagesToDelete = existingImages.filter(
          (img) => img.id && !incomingIds.includes(img.id),
        );
        this.logger.debug(
          `[updateProduct] O'chirilishi kerak bo'lgan rasmlar soni: ${imagesToDelete.length}`,
        );

        // Fayl tizimidan o'chirish
        for (const imgToDel of imagesToDelete) {
          this.logger.debug(
            `[updateProduct] Fayl tizimidan o'chirilmoqda: ${imgToDel.url} (ID: ${imgToDel.id})`,
          );
          try {
            await this.fileService.deleteFileByUrl(imgToDel.url);
            this.logger.debug(
              `[updateProduct] Fayl muvaffaqiyatli o'chirildi: ${imgToDel.url}`,
            );
          } catch (fileDeleteError) {
            this.logger.error(
              `[updateProduct] Faylni o'chirishda xato yuz berdi: ${imgToDel.url}. Xato: ${fileDeleteError.message}`,
              fileDeleteError.stack,
            );
            // Fayl o'chirish xatosi tranzaksiyani to'xtatmasligi mumkin,
            // ammo logda qayd etilishi shart
          }
        }

        if (imagesToDelete.length > 0) {
          this.logger.debug(
            `[updateProduct] Bazadan rasmlarni o'chirish. Son: ${imagesToDelete.length}`,
          );
          await queryRunner.manager.remove(imagesToDelete);
          this.logger.debug(`[updateProduct] Rasmlar bazadan o'chirildi.`);
        }

        let nextOrder =
          existingImages.length > 0
            ? Math.max(...existingImages.map((img) => img.order ?? 0)) + 1
            : 1;
        this.logger.debug(
          `[updateProduct] Rasmlar uchun keyingi boshlang'ich order: ${nextOrder}`,
        );

        for (const imageData of body.images) {
          const { id, url, order } = imageData;
          this.logger.debug(
            `[updateProduct] Rasm ma'lumotini qayta ishlash: ID: ${id}, URL: ${url}, Order: ${order}`,
          );

          if (id) {
            const existingImage = existingImages.find((img) => img.id === id);
            if (existingImage) {
              this.logger.debug(
                `[updateProduct] Mavjud rasmni yangilash: ID: ${id}`,
              );
              if (existingImage.url !== url) {
                this.logger.debug(
                  `[updateProduct] URL o'zgargan. Eski fayl o'chirilmoqda: ${existingImage.url}`,
                );
                try {
                  await this.fileService.deleteFileByUrl(existingImage.url);
                  this.logger.debug(
                    `[updateProduct] Eski fayl muvaffaqiyatli o'chirildi: ${existingImage.url}`,
                  );
                } catch (oldFileDeleteError) {
                  this.logger.error(
                    `[updateProduct] Eski faylni o'chirishda xato: ${existingImage.url}. Xato: ${oldFileDeleteError.message}`,
                    oldFileDeleteError.stack,
                  );
                }
                existingImage.url = url;
              }
              // Order qiymati body dan kelgan bo'lsa, uni ishlatamiz, aks holda mavjudini qoldiramiz
              existingImage.order =
                order !== undefined ? order : existingImage.order;
              updatedImages.push(existingImage);
              this.logger.debug(
                `[updateProduct] Rasm yangilandi: ID: ${existingImage.id}, Yangi URL: ${existingImage.url}, Yangi Order: ${existingImage.order}`,
              );
            } else {
              this.logger.warn(
                `[updateProduct] Bodyda ko'rsatilgan ID: ${id} ga ega rasm bazada topilmadi. E'tiborsiz qoldirildi.`,
              );
            }
          } else if (url) {
            this.logger.debug(
              `[updateProduct] Yangi rasm qo'shilmoqda: URL: ${url}`,
            );
            const newImage = new ProductImage();
            newImage.url = url;
            newImage.product = product;
            // Yangi rasm uchun order qiymati body dan kelgan bo'lsa, uni ishlatamiz, aks holda nextOrder ni beramiz
            newImage.order = order !== undefined ? order : nextOrder++;
            updatedImages.push(newImage);
            this.logger.debug(
              `[updateProduct] Yangi rasm ob'ekti yaratildi: URL: ${newImage.url}, Order: ${newImage.order}`,
            );
          } else {
            this.logger.warn(
              `[updateProduct] Noto'g'ri rasm ma'lumotlari topildi (ID va URL ham yo'q). O'tkazib yuborildi: ${JSON.stringify(imageData)}`,
            );
          }
        }

        if (updatedImages.length > 0) {
          this.logger.debug(
            `[updateProduct] Yangilangan/yangi rasmlarni bazaga saqlash. Son: ${updatedImages.length}`,
          );
          await queryRunner.manager.save(updatedImages);
          this.logger.debug(`[updateProduct] Rasmlar bazada saqlandi.`);
        } else {
          this.logger.debug(
            `[updateProduct] Saqlash uchun yangilangan/yangi rasmlar mavjud emas.`,
          );
        }
        // Product entity-dagi `images` massivini yangilangan rasmlar bilan almashtiramiz
        product.images = updatedImages;
        this.logger.debug(
          `[updateProduct] Rasmlarni yangilash jarayoni yakunlandi.`,
        );
      } else {
        this.logger.debug(
          `[updateProduct] 'body.images' mavjud emas yoki array emas, rasmlar yangilanmadi.`,
        );
        product.images = []; // Rasmlar bo'lmasa, bo'sh massivga aylantiramiz
      }

      // 9. `imageIndex` ni tekshirish va ma'lumotni loglash
      // Bu yerda `imageIndex` faqat mavjud rasmlar orasida to'g'ri indeks ekanligini tekshiramiz.
      // Agar noto'g'ri indeks berilgan bo'lsa, uni 0 ga (birinchi rasm) o'rnatishimiz mumkin.
      if (
        typeof product.imageIndex === 'number' &&
        product.imageIndex >= 0 &&
        product.images.length > product.imageIndex
      ) {
        const mainImageByGivenIndex = product.images[product.imageIndex];
        this.logger.debug(
          `[updateProduct] imageIndex (${product.imageIndex}) orqali asosiy rasm tanlandi. URL: ${mainImageByGivenIndex.url}, Order: ${mainImageByGivenIndex.order}`,
        );
      } else if (product.images.length > 0) {
        // Agar imageIndex noto'g'ri bo'lsa, lekin rasmlar mavjud bo'lsa,
        // imageIndex ni 0 ga o'rnatib qo'yish mantiqan to'g'ri bo'lishi mumkin.
        // Yoki shunchaki ogohlantirish berib, o'zgartirmaslik mumkin.
        // Hozircha ogohlantirish beramiz va 0 ga o'rnatmaymiz.
        this.logger.warn(
          `[updateProduct] Kiritilgan imageIndex (${product.imageIndex}) noto'g'ri yoki rasmlar mavjud emas. Asosiy rasm indeksini yangilash kerak bo'lishi mumkin.`,
        );
      } else {
        this.logger.debug(
          `[updateProduct] Mahsulotda rasm mavjud emas, imageIndex qo'llanilmaydi.`,
        );
      }

      // 10. Mahsulotni yakuniy saqlash
      this.logger.debug(`[updateProduct] Mahsulotni yakuniy saqlash...`);
      const savedProduct = await queryRunner.manager.save(product);
      this.logger.debug(
        `[updateProduct] Mahsulot muvaffaqiyatli yangilandi. ID: ${savedProduct.id}`,
      );

      await queryRunner.commitTransaction();
      return savedProduct;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[updateProduct] Mahsulotni yangilashda xato yuz berdi. Barcha o'zgarishlar bekor qilindi. Xato: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new InternalServerErrorException(
          `Ma'lumotlar bazasi xatosi: ${error.message}`,
        );
      }
      throw new InternalServerErrorException(
        `Mahsulotni yangilashda kutilmagan xato yuz berdi: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
