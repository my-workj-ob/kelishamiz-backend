import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

@ApiTags('Category')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}
  @Get()
  @ApiOkResponse({ description: "Kategoriyalar ro'yxati", type: [Category] })
  @ApiBadRequestResponse({ description: "Yaroqsiz so'rov" })
  @ApiQuery({
    name: 'parentId',
    required: false,
    type: String,
    description:
      'Faqat berilgan ota kategoriyaga tegishli bolalarni olish uchun (null - faqat ota kategoriyalar)',
  })
  async findAll(@Query('parentId') parentId?: string): Promise<Category[]> {
    return this.categoryService.findAll(parentId);
  }

  @Post()
  @ApiOperation({ summary: 'Kategoriya yaratish' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kategoriya ID orqali olish' })
  async findOne(@Param('id') id: string) {
    const existCategory = await this.categoryService.findOne(Number(id));
    if (existCategory === null || undefined) {
      throw new NotFoundException('error');
    }
    return existCategory;
  }
}
