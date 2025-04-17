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
  ApiTags,
} from '@nestjs/swagger';
import { ProductDto } from './dto/create-product.dto';
import { GetProductsDto } from './dto/filter-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}
  @Get()
  async findAll() {
    return this.productService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post()
  @ApiCreatedResponse({
    description: 'Mahsulot muvaffaqiyatli yaratildi',
    type: Product,
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz ma'lumotlar kiritildi" })
  @UsePipes(new ValidationPipe())
  async create(
    @Body() createProductDto: ProductDto,
    @Req() req,
  ): Promise<Product> {
    return this.productService.create(createProductDto, req?.user?.userId);
  }

  @Post('filter')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOkResponse({
    description: "Filtrlangan mahsulotlar ro'yxati",
    type: [Product],
  })
  @ApiBadRequestResponse({ description: "Yaroqsiz filtrlash ma'lumotlari" })
  @UsePipes(new ValidationPipe())
  async getProducts(
    @Body() filters: GetProductsDto,
    @Req() req: any,
  ): Promise<Product[]> {
    const userId = filters.ownProduct ? req?.user?.userId : undefined;

    return this.productService.filter(filters, userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  async toggleLike(@Param('id') id: number, @Req() req) {
    const userId = req.user.userId;
    const isLiked = await this.productService.toggleLike(Number(id), userId);

    const project = await this.productService.findOne(Number(id));
    if (!project) {
      throw new NotFoundException('Product not found'); // ✅ Xatolikni oldini olish
    }

    return { liked: isLiked, likesCount: project.likesCount };
  }

  @Get(':id/like/status')
  async getLikeStatus(
    @Param('id') projectId: number,
    @Query('userId') userId: number,
  ) {
    const liked = await this.productService.checkLikeStatus(projectId, userId);
    return { liked };
  }
}
