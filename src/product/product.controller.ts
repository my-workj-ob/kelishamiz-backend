import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User, UserRole } from './../auth/entities/user.entity'; // User va UserRole ni import qilish
import { JwtOptionalAuthGuard } from './../common/jwt/guards/jwt-optional-auth.guard';
import { SearchService } from './../search-filter/search-filter.service';
import {
  ProductDto,
  PublishProductDto,
  TopProductDto,
} from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RolesGuard } from './../common/interceptors/roles/roles.guard';
import { Roles } from './../common/interceptors/roles/role.decorator';
import { UpdateProductDto } from './dto/update-product.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    phone: string;
    username: string;
    role: UserRole;
  };
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseInterceptors(ClassSerializerInterceptor)
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Get()
  @ApiOkResponse({
    description: "Barcha mahsulotlar ro'yxati (pagination, filtrlar bilan)",
    schema: {
      example: {
        data: [],
        total: 123,
        page: 1,
        pageSize: 10,
      },
    },
  })
  @ApiOperation({
    summary: 'Barcha mahsulotlarni pagination, filtrlar bilan olish',
    description:
      'Barcha mahsulotlarni sahifalangan ro\'yxatini qaytaradi. Filtering regionId, districtIds bo\'yicha amalga oshiriladi. Autentifikatsiya qilingan foydalanuvchilar uchun "isLike" holati haqiqiy userId asosida, autentifikatsiya qilinmagan foydalanuvchilar uchun esa "likedIds" query parametri asosida aniqlanadi. Adminlar barcha mahsulotlarni (published/unpublished) ko\'rishi mumkin.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Sahifa raqami (standart: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Sahifadagi elementlar soni (standart: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'likedIds',
    required: false,
    type: String,
    description:
      'Autentifikatsiya qilinmagan foydalanuvchilar uchun "like" qilingan mahsulot IDlari. Vergul bilan ajratilgan string bo\'lishi kerak (masalan: "1,2,3").',
    example: '1,5,10',
  })
  @ApiQuery({
    name: 'regionId',
    required: false,
    type: Number,
    description: "Mahsulotlarni ma'lum bir region IDsi bo'yicha filtrlash.",
    example: 1,
  })
  @ApiQuery({
    name: 'districtIds',
    required: false,
    type: String,
    description:
      "Mahsulotlarni ma'lum tuman IDlari bo'yicha filtrlash. Vergul bilan ajratilgan string bo'lishi kerak (maksimal 3 ta, masalan: \"101,102,103\").",
    example: '101,102',
  })
  @UseGuards(JwtOptionalAuthGuard)
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true }))
    pageSize: number = 10,
    @Query('likedIds') likedIdsStr?: string,
    @Query('regionId', new ParseIntPipe({ optional: true })) regionId?: number,
    @Query('districtIds') districtIdsStr?: string,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    console.log(
      `Received GET /products request. User: ${req.user?.userId}, likedIdsStr: ${likedIdsStr}, regionId: ${regionId}, districtIdsStr: ${districtIdsStr}`,
    );

    const userId = req.user?.userId ?? null;
    const isAdmin = req.user?.role === UserRole.ADMIN;

    const likedIds = likedIdsStr
      ? likedIdsStr
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id))
      : [];

    const districtIds = districtIdsStr
      ? districtIdsStr
          .split(',')
          .map((id) => Number(id.trim()))
          .filter((id) => !isNaN(id))
      : [];

    return this.productService.findAllPaginated(
      userId,
      page,
      pageSize,
      likedIds,
      isAdmin,
      regionId,
      districtIds,
    );
  }
  @Get('top')
  @ApiOperation({
    summary:
      'Topga chiqarilgan mahsulotlar ro‘yxati (Adminlar unpublished top mahsulotlarni ham ko`ra oladi)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    example: 10,
  })
  @UseGuards(JwtOptionalAuthGuard)
  async findAllTop(
    @Req() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 10,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const userId = req.user?.userId ?? null;
    const isAdmin = req.user?.role === UserRole.ADMIN;

    return this.productService.findAllTopPaginated(
      userId,
      page,
      pageSize,
      isAdmin,
    );
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Get('liked')
  @ApiOperation({ summary: 'Foydalanuvchi yoqtirgan mahsulotlar (DB + Local)' })
  @ApiQuery({
    name: 'ids',
    required: false,
    type: String,
    description: 'Mahsulot IDlari (vergul bilan ajratilgan)',
  })
  async getLikedProducts(
    @Req() req: AuthenticatedRequest,
    @Query('ids') ids?: string,
  ) {
    const userId = req.user?.userId ?? null;

    const localIds = ids
      ? ids
          .split(',')
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      : [];

    return this.productService.syncLikesFromLocal(userId, localIds);
  }

  @Get(':id/like/status')
  @ApiOkResponse({
    description: 'Mahsulotning layk statusini olish',
  })
  @ApiOperation({ summary: 'user like status ' })
  @UseGuards(JwtOptionalAuthGuard)
  async getLikeStatus(
    @Param('id', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
    @Query('userId', new ParseIntPipe({ optional: true }))
    userIdFromQuery?: number,
  ): Promise<{ liked: boolean }> {
    const userId = userIdFromQuery ?? req.user?.userId ?? null;
    if (!userId) {
      throw new BadRequestException(
        'User ID is required to check like status.',
      );
    }
    const liked = await this.productService.checkLikeStatus(projectId, userId);
    return { liked };
  }

  @Post(':id/view')
  async viewProduct(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: { utm?: string },
  ) {
    const productId = parseInt(id, 10);

    const userId = (req as any).user?.userId ?? null;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')?.[0]?.trim() ||
      req.socket.remoteAddress ||
      null;
    const userAgent = req.headers['user-agent'] || '';

    await this.productService.incrementViewCount(
      productId,
      userId,
      ip,
      userAgent,
      body?.utm,
    );

    return { success: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        categoryId: { type: 'number' },

        paymentType: { type: 'string' },
        currencyType: { type: 'string' },
        mainImage: { type: 'number' },
        negotiable: { type: 'boolean', default: false },
        regionId: { type: 'number' }, // districtId bilan birga kelishi kerak
        districtId: { type: 'number' },
        imageIndex: { type: 'number' },
        isPublish: {
          type: 'boolean',
          default: false,
          description: 'Adminlar uchun publish statusini o`rnatish',
        }, // isPublish ni qo'shish
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              propertyId: { type: 'number' },
              type: { type: 'string' },
              value: { type: 'object' },
            },
          },
          nullable: true,
        },
        images: {
          type: 'array',
          items: {
            type: 'string', // 'binary' format, lekin swagger schema da 'string'
            format: 'binary',
          },
        },
      },
      required: [
        'title',
        'description',
        'price',
        'categoryId',
        'location',
        'paymentType',
        'currencyType',
        'districtId',
        'images', // Rasmlar majburiy bo'lishi kerak
      ],
    },
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz ma'lumotlar kiritildi" })
  @ApiOperation({ summary: "Mahsulot qo'shish" })
  @UseInterceptors(FilesInterceptor('files'))
  @UseGuards(AuthGuard('jwt'))
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
  ): Promise<Product> {
    const createProductDto: Omit<ProductDto, 'images'> = {
      title: body.title,
      description: body.description,
      price: Number(body.price),
      categoryId: Number(body.categoryId),
      paymentType: body.paymentType,
      currencyType: body.currencyType,
      negotiable:
        (body.negotiable === 'true' && true) ||
        (body.negotiable === 'false' && false),
      regionId: Number(body.regionId),
      districtId: Number(body.districtId),
      properties:
        typeof body.properties === 'string'
          ? JSON.parse(body.properties)
          : body.properties || [],
      imageIndex: Number(body.imageIndex || 0),
    };

    console.log('Qabul qilingan body:', body);
    console.log('Parsed createProductDto:', createProductDto);

    if (!req.user) {
      throw new BadRequestException('User not authenticated.');
    }
    return this.productService.create(files, createProductDto, req.user.userId);
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Post('filter')
  @ApiQuery({
    name: 'likedIds',
    required: false,
    type: String,
    description: 'Mahsulot IDlari (vergul bilan ajratilgan)',
  })
  @ApiOkResponse({
    description: "Filtrlangan mahsulotlar ro'yxati",
    type: [Product],
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz filtrlash ma'lumotlari" })
  @ApiOperation({ summary: 'filterlash' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async getProducts(
    @Body() filters: GetProductsDto,
    @Req() req: AuthenticatedRequest,
    @Query('likedIds') likedIdsStr?: string,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const userId =
      filters.ownProduct && req?.user?.userId ? req.user.userId : undefined;

    if (req?.user?.userId && filters.title?.trim()) {
      const user = req.user as unknown as User;
      await this.searchService.saveSearch(user, filters.title.trim());
    }

    const likedIds = likedIdsStr
      ? likedIdsStr
          .split(',')
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      : [];

    const isAdmin = req.user?.role === UserRole.ADMIN;

    return this.productService.filter(filters, userId, likedIds, isAdmin);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  @ApiOkResponse({
    description: "Mahsulotga layk qo'shish/olib tashlash natijasi",
  })
  @ApiBadRequestResponse({ description: 'Mahsulot topilmadi' })
  @ApiOperation({
    summary: "Mahsulotga layk qo'shish/olib tashlash  ya'ni toggle",
  })
  async toggleLike(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ liked: boolean; likesCount: number }> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated.');
    }
    const isLiked = await this.productService.toggleLike(id, userId);

    const product = await this.productService.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return { liked: isLiked, likesCount: product.likesCount };
  }

  @Get('search-by-id-and-category/:title')
  @UseGuards(JwtOptionalAuthGuard)
  @ApiOperation({
    summary:
      'Mahsulotni title va categoryId bo`yicha aqlli qidirish (Adminlar unpublished ni ham ko`ra oladi)',
  })
  async searchByIdAndCategory(
    @Param('title') title: string,
    @Query('categoryId', ParseIntPipe) categoryId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    return this.productService.getSmartSearchByIdAndCategory(
      title,
      categoryId,
      isAdmin,
    );
  }

  @Get('by-id/:id')
  @UseGuards(JwtOptionalAuthGuard)
  @ApiOperation({
    summary:
      'Mahsulotni ID bo`yicha olish (Adminlar unpublished ni ham ko`ra oladi)',
  })
  async findOneById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const product = await this.productService.findById(id, isAdmin);
    if (!product) throw new NotFoundException('topilmadi');
    return product;
  }

  @Patch(':id/top')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Mahsulotning TOP statusini va Publish statusini yangilash (faqat admin)',
  })
  @ApiBody({
    type: TopProductDto,
    description: 'TOP statusini yangilash ma`lumotlari',
  })
  async updateTopStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() topData: TopProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    return this.productService.updateTopStatus(id, topData, isAdmin); 
  }

  @Patch(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN) 
  @ApiOperation({
    summary:
      'Mahsulotning TOP statusini va Publish statusini yangilash (faqat admin)',
  })
  @ApiBody({
    type: TopProductDto,
    description: 'TOP statusini yangilash ma`lumotlari',
  })
  async updatePublish(
    @Param('id', ParseIntPipe) id: number,
    @Body() isPublish: PublishProductDto,
    @Req() req: AuthenticatedRequest, 
  ) {
    const isAdmin = req.user?.role === UserRole.ADMIN;
    return this.productService.updatePublish(id, isPublish, isAdmin);
  }

  @Delete('by-id/:id') 
  @UseGuards(AuthGuard('jwt'), RolesGuard) 
  @Roles(UserRole.ADMIN) 
  @ApiOperation({ summary: 'Mahsulotni ID bo`yicha o`chirish (faqat admin)' })
  async deleteOneById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ statusCode: number; message: string }> {
    await this.productService.deleteOneById(id);

    return {
      statusCode: 200,
      message: 'Product successfully deleted',
    };
  }
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtOptionalAuthGuard)
  @ApiOperation({ summary: 'Mahsulotni yangilash (rasmlar bilan)' })
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UpdateProductDto,

    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Yangi yuklanayotgan rasm fayllari',
        },
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', nullable: true },
              url: { type: 'string' },
              order: { type: 'number' },
            },
          },
        },
        propertyValues: {
          type: 'object',
          additionalProperties: {
            type: 'object',
          },
          example: {
            color: { value: 'red' },
            size: { value: 'L' },
          },
        },
      },
      required: ['title', 'price'], // keraklilar
    },
  })
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any, 
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    console.log('Received body:', body); 
    console.log('Received files:', files);

    try {
      if (typeof body.properties === 'string') {
        body.properties = JSON.parse(body.properties);
      }
      if (typeof body.images === 'string') {
        body.images = JSON.parse(body.images);
      }
    } catch (parseError) {
      throw new HttpException(
        `Failed to parse JSON fields (properties/images): ${parseError.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const parseNumber = (value: any) => {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    };
    const parseIntSafe = (value: any) => {
      const num = parseInt(value, 10);
      return isNaN(num) ? undefined : num;
    };

    if (body.price !== undefined) body.price = parseNumber(body.price);
    if (body.minPrice !== undefined) body.minPrice = parseNumber(body.minPrice);
    if (body.maxPrice !== undefined) body.maxPrice = parseNumber(body.maxPrice);

    if (body.categoryId !== undefined)
      body.categoryId = parseIntSafe(body.categoryId);
    if (body.profileId !== undefined)
      body.profileId = parseIntSafe(body.profileId);
    if (body.regionId !== undefined)
      body.regionId = parseIntSafe(body.regionId);
    if (body.districtId !== undefined)
      body.districtId = parseIntSafe(body.districtId);
    if (body.imageIndex !== undefined)
      body.imageIndex = parseIntSafe(body.imageIndex);

    const parseBoolean = (value: any) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    };

    if (body.negotiable !== undefined)
      body.negotiable = parseBoolean(body.negotiable);
    if (body.ownProduct !== undefined)
      body.ownProduct = parseBoolean(body.ownProduct);
    if (body.isTop !== undefined) body.isTop = parseBoolean(body.isTop);
    if (body.isPublish !== undefined)
      body.isPublish = parseBoolean(body.isPublish);

    if (
      body.topExpiresAt !== undefined &&
      typeof body.topExpiresAt === 'string'
    ) {
      try {
        const date = new Date(body.topExpiresAt);
        if (!isNaN(date.getTime())) {
          body.topExpiresAt = date;
        } else {
          body.topExpiresAt = undefined;
        }
      } catch (dateParseError) {
        body.topExpiresAt = undefined;
      }
    }

    return this.productService.updateProduct(id, body, files);
  }
}
