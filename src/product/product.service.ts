// src/product/product.service.ts
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeleteResult,
  EntityNotFoundError,
  ILike,
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
import { ProductProperty } from './entities/product-property-entity';
import { Product } from './entities/product.entity';
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
      relations: ['category', 'profile', 'district', 'images', 'likes'],
      order: { isTop: 'DESC', createdAt: 'DESC' },
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
      order: { topExpiresAt: 'DESC' },
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
    isAdmin: boolean = false, // <-- Yangi parametr
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
    // Bu metodni User Products ni olib kelishda ishlatish uchun
    // Agar bu faqat foydalanuvchining o'z mahsulotlari bo'lsa, isPublish ni tekshirmaslik kerak
    // Agar buni boshqa foydalanuvchi ko'radigan bo'lsa, isPublish ni tekshirish kerak
    return this.profileRepository.findOne({
      where: { id },
      relations: ['products', 'products.category', 'products.images'],
    });
  }

  async syncLikesFromLocal(
    userId: number | null,
    localLikedProductIds?: number[],
  ) {
    // 1. Mehmon foydalanuvchi bo‘lsa, faqat localLikedProductIds asosida qaytaramiz
    if (!userId) {
      const products = await this.productRepository.find({
        where: { id: In(localLikedProductIds ?? []) },
        relations: ['category', 'images', 'likes', 'profile'],
      });

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

    // 3. Yangi like qilinadigan mahsulotlar aniqlanadi
    const newProductIdsToLike =
      localLikedProductIds?.filter(
        (id) => !alreadyLikedProductIds.includes(id),
      ) ?? [];

    // 4. Yangi like'lar DBga yoziladi
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
      console.log('Yangi mahsulotlar like qilindi:', productsToLike);

      user.likes = [...user.likes, ...productsToLike];
      await this.userRepository.save(user);
      console.log('Foydalanuvchining likes yangilandi:', user.likes);
    }

    // 5. Yakuniy liked product ID larni tayyorlaymiz
    const finalLikedProductIds = [
      ...alreadyLikedProductIds,
      ...newProductIdsToLike,
    ];

    console.log('Final liked IDs:', finalLikedProductIds);

    // 6. Faqat shu ID'lar bo'yicha mahsulotlar olib kelinadi
    const products = await this.productRepository.find({
      where: { id: In(finalLikedProductIds) },
      relations: ['category', 'images', 'likes', 'profile'],
    });

    const orderedProducts = finalLikedProductIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => !!p);

    console.log('Ordered liked products:', orderedProducts);

    return orderedProducts;
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

        await this.fileService.saveFile(vercelFileUrl); // Faylni DBga saqlash

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
}
