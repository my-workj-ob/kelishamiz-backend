/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { User, UserRole } from './../auth/entities/user.entity'; // Import UserRole
import { JwtOptionalAuthGuard } from './../common/jwt/guards/jwt-optional-auth.guard';
import { RolesGuard } from './../common/interceptors/roles/roles.guard';
import { Roles } from './../common/interceptors/roles/role.decorator';
import { SearchService } from './../search-filter/search-filter.service';
import { ProductDto, TopProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DeleteResult } from 'typeorm';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 🔹 GET: All products
  @Get()
  @ApiOkResponse({
    description: "Barcha mahsulotlar ro'yxati",
    schema: {
      example: {
        data: [
          /* array of products */
        ],
        total: 123,
        page: 1,
        pageSize: 10,
      },
    },
  })
  @ApiOperation({
    summary: 'barcha productlarni get qilish (pagination bilan)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Sahifa raqami (standart: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Sahifadagi elementlar soni (standart: 10)',
  })
  @UseGuards(JwtOptionalAuthGuard) // Allows access even if no JWT is provided
  @ApiQuery({
    name: 'likedIds',
    required: false,
    type: String,
    description: 'Mahsulot IDlari (vergul bilan ajratilgan)',
  })
  async findAll(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 10,
    @Query('likedIds') likedIdsStr?: string | null,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const userId = req?.user?.userId ?? null;

    const likedIds = likedIdsStr
      ? likedIdsStr
          .split(',')
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      : [];

    return this.productService.findAllPaginated(
      userId,
      page,
      pageSize,
      likedIds,
    );
  }

  @Get('top')
  @ApiOperation({ summary: 'Topga chiqarilgan mahsulotlar ro‘yxati' })
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
  @UseGuards(JwtOptionalAuthGuard) // Top products can be viewed by anyone
  async findAllTop(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 10,
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const userId = req?.user?.userId ?? null;
    return this.productService.findAllTopPaginated(userId, page, pageSize);
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
  async getLikedProducts(@Req() req: any, @Query('ids') ids?: string) {
    const userId = req?.user?.userId ?? null;

    const localIds = ids
      ? ids
          .split(',')
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      : [];

    console.log('Local liked product IDs:', localIds);

    return this.productService.syncLikesFromLocal(userId, localIds);
  }

  @UseGuards(JwtOptionalAuthGuard) // Anyone can check like status, but userId will determine the result
  @Get(':id/like/status')
  @ApiOkResponse({
    description: 'Mahsulotning layk statusini olish',
  })
  @ApiOperation({ summary: 'user like status ' })
  async getLikeStatus(
    @Param('id', ParseIntPipe) projectId: number,
    @Req() req: any, // Get userId from request for authenticated users
  ): Promise<{ liked: boolean }> {
    const userId = req?.user?.userId ?? null; // Null if not authenticated
    const liked = await this.productService.checkLikeStatus(projectId, userId);
    return { liked };
  }

  // 🔸 POST: Create product - Only for authenticated users (USER or ADMIN)
  @UseGuards(AuthGuard('jwt')) // Requires a valid JWT
  @Roles(UserRole.USER, UserRole.ADMIN) // Only users with 'USER' or 'ADMIN' role can create products
  @UseGuards(RolesGuard) // Apply the RolesGuard
  @ApiConsumes('multipart/form-data')
  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        categoryId: { type: 'number' },
        location: { type: 'string' },
        paymentType: { type: 'string' },
        currencyType: { type: 'string' },
        mainImage: { type: 'number' }, // Renamed from mainImage to imageIndex
        negotiable: { type: 'boolean', default: false },
        regionId: { type: 'number' },
        districtId: { type: 'number' },
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
        files: {
          // Corrected from 'images' to 'files' to match FilesInterceptor
          type: 'array',
          items: {
            type: 'string',
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
        'files', // Rasmlar majburiy bo'lishi kerak
      ],
    },
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz ma'lumotlar kiritildi" })
  @ApiOperation({ summary: "Mahsulot qo'shish" })
  @UseInterceptors(FilesInterceptor('files')) // Frontendda yuborilgan 'files' nomi bilan moslashtirilgan
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @Req() req: any,
  ): Promise<Product> {
    const createProductDto: Omit<ProductDto, 'images'> = {
      title: body.title,
      description: body.description,
      price: Number(body.price),
      categoryId: Number(body.categoryId),
      location: body.location,
      paymentType: body.paymentType,
      currencyType: body.currencyType,
      negotiable:
        (body.negotiable === 'true' && true) ||
        (body.negotiable === 'false' && false),
      regionId: Number(body.regionId),
      districtId: Number(body.districtId),
      properties: JSON.parse(body.properties || '[]'), // Parse properties if it's a string
      imageIndex: Number(body.imageIndex || 0),
    };

    console.log(body);

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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true })) // Add transform and whitelist for DTO validation
  async getProducts(
    @Body() filters: GetProductsDto,
    @Req() req: any,
    @Query('likedIds') likedIdsStr?: string, // localStorage’dan keladi
  ): Promise<{
    data: (Product & { isLike: boolean })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const userId =
      filters.ownProduct && req?.user?.userId ? req.user.userId : undefined;

    if (req?.user?.userId && filters.title?.trim()) {
      const user = req.user as User;
      await this.searchService.saveSearch(user, filters.title.trim());
    }

    const likedIds = likedIdsStr
      ? likedIdsStr
          .split(',')
          .map((id) => Number(id))
          .filter((id) => !isNaN(id))
      : [];

    return this.productService.filter(filters, userId, likedIds);
  }

  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.USER, UserRole.ADMIN) // Both USER and ADMIN can like/unlike
  @UseGuards(RolesGuard)
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
    @Req() req: any,
  ): Promise<{ liked: boolean; likesCount: number }> {
    const userId = req?.user?.userId;
    if (!userId) {
      throw new BadRequestException('User not authenticated.');
    }
    const isLiked = await this.productService.toggleLike(Number(id), userId);

    const project = await this.productService.findById(Number(id));
    if (!project) {
      throw new NotFoundException('Product not found');
    }

    return { liked: isLiked, likesCount: project.likesCount };
  }

  @Get('search-by-id-and-category/:title')
  @ApiOperation({ summary: 'Mahsulotlarni ID va kategoriyaga ko‘ra qidirish' })
  async searchByIdAndCategory(
    @Param('title') title: string,
    @Query('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.productService.getSmartSearchByIdAndCategory(title, categoryId);
  }

  @Get('by-id/:id') // universal route emas!
  @ApiOperation({ summary: 'Mahsulotni ID bo‘yicha olish' })
  async findOneById(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundException('topilmadi');
    return product;
  }

  // Admin-specific routes
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN) // Only ADMIN can update top status
  @Patch(':id/top')
  @ApiOperation({
    summary: 'Mahsulotning top statusini yangilash (faqat admin uchun)',
  })
  async updateTopStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() topData: TopProductDto,
  ) {
    return this.productService.updateTopStatus(id, topData);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN) // Only ADMIN can delete products
  @Delete('by-id/:id') // universal route emas!
  @ApiOperation({
    summary: 'Mahsulotni ID bo‘yicha o‘chirish (faqat admin uchun)',
  })
  async deleteOneById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ statusCode: number; message: string }> {
    await this.productService.deleteOneById(id);

    return {
      statusCode: 200,
      message: 'Product successfully deleted',
    };
  }
}
