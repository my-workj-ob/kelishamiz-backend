// src/banner/banner.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './../common/interceptors/roles/roles.guard';
import { Roles } from './../common/interceptors/roles/role.decorator';
import { UserRole } from './../auth/entities/user.entity';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Banner } from './entities/banner.entity';
import { JwtOptionalAuthGuard } from './../common/jwt/guards/jwt-optional-auth.guard';

@ApiTags('Banners')
@ApiBearerAuth()
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi banner yaratish (faqat admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', required: [] },
        description: { type: 'string', required: [] },
        linkUrl: { type: 'string', required: [] },
        order: { type: 'number', required: [] },
        isActive: { type: 'boolean', required: [] },
        placement: { type: 'string', default: 'home_hero' },
        file: { type: 'string', format: 'binary', description: 'Banner rasmi' },
      },
      required: ['placement', 'file'], // Rasm majburiy
    },
  })
  @UseInterceptors(FileInterceptor('file')) // 'file' nomi bilan faylni kutamiz
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<CreateBannerDto, 'imageUrl'>,
  ): Promise<Banner> {
    
    if (!file) {
      throw new BadRequestException('Banner rasmi majburiy.');
    }
    const createBannerDto: CreateBannerDto = {
      ...body,
      order: body.order ? Number(body.order) : undefined,
      isActive:
        body.isActive !== undefined
          ? String(body.isActive) === 'true' || body.isActive === true
          : undefined,
    };
    return this.bannerService.create(file, createBannerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha bannerlarni olish (faqat admin)' })
  @ApiQuery({
    name: 'placement',
    required: false,
    description: 'Banner joylashuvi bo`yicha filter',
  })
  async findAll(@Query('placement') placement?: string): Promise<Banner[]> {
    return this.bannerService.findAll(placement);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ID bo`yicha bannerni olish (faqat admin)' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Banner> {
    return this.bannerService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Bannerni yangilash (faqat admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', required: [] },
        description: { type: 'string', required: [] },
        linkUrl: { type: 'string', required: [] },
        order: { type: 'number', required: [] },
        isActive: { type: 'boolean', required: [] },
        placement: { type: 'string', required: [] },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Yangi banner rasmi (ixtiyoriy)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<UpdateBannerDto, 'imageUrl'>,
  ): Promise<Banner> {
    const updateBannerDto: UpdateBannerDto = {
      ...body,
      order: body.order ? Number(body.order) : undefined,
      isActive:
        body.isActive !== undefined
          ? String(body.isActive) === 'true' || body.isActive === true
          : undefined,
    };
    return this.bannerService.update(id, file, updateBannerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Bannerni o`chirish (faqat admin)' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.bannerService.remove(id);
  }

  // Jamoat uchun bannerlarni olish (autentifikatsiya shart emas)
  @Get('public/active')
  @ApiOperation({
    summary: 'Faol bannerlarni joylashuv bo`yicha olish (hamma uchun)',
  })
  @ApiQuery({
    name: 'placement',
    required: true,
    description: 'Banner joylashuvi',
  })
  @UseGuards(JwtOptionalAuthGuard) // Autentifikatsiya shart emas
  async getActiveBannersPublic(
    @Query('placement') placement: string,
  ): Promise<Banner[]> {
    return this.bannerService.findActiveByPlacement(placement);
  }
}
