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

  @Post()
  @ApiOperation({ summary: 'Yangi kategoriya yaratish' })
  @ApiOkResponse({ description: 'Kategoriya yaratildi', type: Category })
  @ApiBadRequestResponse({ description: "Yaroqsiz so'rov ma'lumotlari" })
  create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({
    summary:
      "Barcha kategoriyalarni olish yoki ota kategoriya bo'yicha filtrlash",
  })
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

  @Get(':id')
  @ApiOperation({ summary: 'Kategoriya ID orqali olish' })
  @ApiOkResponse({ description: "Kategoriya ma'lumotlari", type: Category })
  @ApiBadRequestResponse({ description: 'Kategoriya topilmadi' })
  async findOne(@Param('id') id: string): Promise<Category> {
    const existCategory = await this.categoryService.findOne(Number(id));
    if (!existCategory) {
      throw new NotFoundException(`Kategoriya ${id} bilan topilmadi`);
    }
    return existCategory;
  }

  @Get(':id/children')
  @ApiOperation({ summary: 'Kategoriya ID orqali faqat childlarni olish' })
  @ApiOkResponse({ description: "Kategoriya ma'lumotlari", type: Category })
  @ApiBadRequestResponse({ description: 'Kategoriya topilmadi' })
  async findAllOnlyChildCategories(@Param('id') id: string) {
    const existCategory = await this.categoryService.findAllOnlyChildCategories(
      Number(id),
    );
    if (!existCategory) {
      throw new NotFoundException(`Kategoriya ${id} bilan topilmadi`);
    }
    return existCategory;
  }
}
