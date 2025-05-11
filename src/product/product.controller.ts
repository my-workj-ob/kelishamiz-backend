/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
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
  ApiTags,
} from '@nestjs/swagger';
import { User } from './../auth/entities/user.entity';
import { JwtOptionalAuthGuard } from './../common/jwt/guards/jwt-optional-auth.guard';
import { SearchService } from './../search-filter/search-filter.service';
import { ProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
    type: [Product],
  })
  @ApiOperation({ summary: 'barcha productlarni get qilish' })
  async findAll(): Promise<Product[]> {
    return this.productService.findAll();
  }
  // IDga asoslangan mahsulotni qidirish

  @UseGuards(JwtOptionalAuthGuard)
  @Get('liked/:userId')
  @ApiOperation({ summary: 'foydalnavchi yoqtirgan mahsulotlar' })
  async getLikedProducts(@Param('userId') userId: number) {
    return this.productService.getLikedProducts(userId);
  }

  // 🔹 GET: Product like status
  @Get(':id/like/status')
  @ApiOkResponse({
    description: 'Mahsulotning layk statusini olish',
  })
  @ApiOperation({ summary: 'user like status ' })
  async getLikeStatus(
    @Param('id') projectId: number,
    @Query('userId') userId: number,
  ): Promise<{ liked: boolean }> {
    const liked = await this.productService.checkLikeStatus(projectId, userId);
    return { liked };
  }

  // 🔸 POST: Create product

  @UseGuards(AuthGuard('jwt'))
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
        mainImage: { type: 'number' },
        negotiable: { type: 'boolean', default: false },
        // regionId: { type: 'number' },
        // districtId: { type: 'number' },
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
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
            },
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
  @UseInterceptors(FilesInterceptor('files')) // Frontendda yuborilgan 'files' nomi bilan moslashtirilgan
  @Post()
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
      negotiable: Boolean(body.negotiable),
      regionId: Number(body.regionId),
      districtId: Number(body.districtId),
      properties: body.properties || [],
      imageIndex: body.imageIndex || 0,
    };

    return this.productService.create(files, createProductDto, req.user.userId);
  }

  @UseGuards(JwtOptionalAuthGuard)
  @Post('filter')
  @ApiOkResponse({
    description: "Filtrlangan mahsulotlar ro'yxati",
    type: [Product],
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz filtrlash ma'lumotlari" })
  @ApiOperation({ summary: 'filterlash' })
  @UsePipes(new ValidationPipe())
  async getProducts(
    @Body() filters: GetProductsDto,
    @Req() req: any,
  ): Promise<Product[]> {
    const userId =
      filters.ownProduct && req?.user?.userId ? req.user.userId : undefined;

    if (req?.user?.userId && filters.title && filters.title.trim() !== '') {
      const user = req.user as User;
      await this.searchService.saveSearch(user, filters.title.trim());
    }

    return this.productService.filter(filters, userId);
  }
  // 🔸 POST: Toggle like
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
    @Param('id') id: number,
    @Req() req: any,
  ): Promise<{ liked: boolean; likesCount: number }> {
    const userId = req?.user?.userId;
    const isLiked = await this.productService.toggleLike(Number(id), userId);

    const project = await this.productService.findOne(req, Number(id));
    if (!project) {
      throw new NotFoundException('Product not found');
    }

    return { liked: isLiked, likesCount: project.likesCount };
  }

  @Get('search-by-id-and-category/:title')
  async searchByIdAndCategory(
    @Param('title') title: string,
    @Query('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.productService.getSmartSearchByIdAndCategory(title, categoryId);
  }

  @Get('by-id/:id') // universal route emas!
  async findOneById(@Param('id', ParseIntPipe) id: number) {
    const product = await this.productService.findById(id);
    if (!product) throw new NotFoundException('topilmadi');
    return product;
  }
}
