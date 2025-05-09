/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
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

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
  ) { }

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

  @UseGuards(JwtOptionalAuthGuard)
  @Get('liked/:userId')
  @ApiOperation({ summary: 'foydalnavchi yoqtirgan mahsulotlar' })
  async getLikedProducts(@Param('userId') userId: number) {
    return this.productService.getLikedProducts(userId);
  }
  // 🔹 GET: One product by ID
  @Get(':id')
  @ApiOkResponse({ description: "Mahsulot ma'lumotlari", type: Product })
  @ApiBadRequestResponse({ description: 'Mahsulot topilmadi' })
  @ApiOperation({ summary: 'id orqali get qilish' })
  async findOne(@Param('id') id: string) {
    return await this.productService.findOne(Number(id));
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
  @Post()
  @ApiCreatedResponse({
    description: 'Mahsulot muvaffaqiyatli yaratildi',
    type: Product,
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz ma'lumotlar kiritildi" })
  @ApiOperation({ summary: "mahsulot qo'shish" })
  @UsePipes(new ValidationPipe())
  async create(
    @Body() createProductDto: ProductDto,
    @Req() req: any,
    files: Express.Multer.File[], // Fayllarni qabul qilish
  ): Promise<Product> {
    return this.productService.create(createProductDto, req?.user?.userId, files);
  }

  // 🔸 POST: Filter products
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

    const project = await this.productService.findOne(Number(id));
    if (!project) {
      throw new NotFoundException('Product not found');
    }

    return { liked: isLiked, likesCount: project.likesCount };
  }
}
