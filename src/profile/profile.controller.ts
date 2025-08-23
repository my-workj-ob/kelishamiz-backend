import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Profile } from './enities/profile.entity';
import { ProfileService } from './profile.service';
import { ProductService } from './../product/product.service';
import { SearchService } from './../search-filter/search-filter.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/file/file.service';
import { UploadService } from 'src/file/uploadService';

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('profiles')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly productService: ProductService,
    private readonly searchService: SearchService,
    private readonly fileService: FileService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Profil yaratildi', type: Profile })
  async create(
    @Body() createProfileDto: CreateProfileDto,
    @Req() req: { user: { userId: number } }, // Req tipini mos keladigan Request tipiga o'zgartirildi
  ): Promise<Profile> {
    const user = req.user; // Payload user obyektida bo'lishi mumkin
    if (!user || !user.userId) {
      throw new BadRequestException("Foydalanuvchi ma'lumotlari topilmadi");
    }
    return await this.profileService.create(createProfileDto);
  }

  @Get()
  @ApiOkResponse({ description: "Barcha profillar ro'yxati", type: [Profile] })
  async findAll(): Promise<Profile[]> {
    return await this.profileService.findAll();
  }

  @Get('me')
  @ApiOkResponse({ description: 'Foydalanuvchining profili', type: Profile })
  async getMe(@Req() req: { user: { userId: number } }): Promise<any> {
    const user = req.user;
    const existUser = await this.profileService.findByUser(user.userId);
    if (!existUser) {
      throw new NotFoundException('Foydalanuvchi profili topilmadi');
    }

    return {
      ...existUser,
      userId: user.userId, // userId qo'shildi
    };
  }

  @Get(':id')
  @ApiOkResponse({ description: "Profil ma'lumotlari", type: Profile })
  async findOne(@Param('id') id: string): Promise<Profile> {
    return await this.profileService.findOne(+id);
  }
  @Get('me/dashboard')
  @ApiOkResponse({
    description: 'Foydalanuvchining profil dashboardi',
    type: Profile,
  })
  async getMeDashboard(
    @Req() req: { user: { userId: number } },
    @Query('filter') filter: string,
  ): Promise<any> {
    if (!filter) {
      throw new BadRequestException('Filter parametri kerak');
    }
    if (!req.user || !req.user.userId) {
      throw new BadRequestException("Foydalanuvchi ma'lumotlari topilmadi");
    }
    const userId = req.user?.userId;
    const existUser = await this.profileService.findByUser(userId);
    if (!existUser) {
      throw new NotFoundException('Foydalanuvchi profili topilmadi');
    }

    switch (filter) {
      case 'elonlar': {
        const userProducts = await this.productService.getUserProducts(userId);
        if (!userProducts) {
          throw new NotFoundException('Foydalanuvchi mahsulotlari topilmadi');
        }
        return userProducts;
      }
      case 'xabarlarim':
        break;
      case 'saqlanganlar': {
        const savedProducts =
          await this.productService.syncLikesFromLocal(userId);

        if (!savedProducts) {
          throw new NotFoundException('Foydalanuvchi mahsulotlari topilmadi');
        }
        return savedProducts;
      }
      case 'qidiruvlar': {
        const userSearched = await this.searchService.getAllUserSearches(
          userId, // Pass the userId directly as it matches the expected type
          1,
          10,
        );

        if (!userSearched) {
          throw new NotFoundException('Foydalanuvchi mahsulotlari topilmadi');
        }

        return {
          data: userSearched.data,
          total: userSearched.total,
        };
      }
      case 'mening-hisobim':
        return this.profileService.findOne(userId);
      default:
        throw new BadRequestException('Noto‘g‘ri filter qiymati');
    }

    return existUser;
  }
  @Patch('me')
  @ApiOkResponse({ description: 'Profil yangilandi', type: Profile })
  async updateMe(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: { user: { userId: number } },
  ): Promise<Profile> {
    const user = req.user;
    if (!user || !user.userId) {
      throw new BadRequestException("Foydalanuvchi ma'lumotlari topilmadi");
    }
    const profile = await this.profileService.findByUser(user?.userId);
    if (!profile) {
      return await this.profileService.create(updateProfileDto);
    }
    return await this.profileService.update(profile.id, updateProfileDto);
  }

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async updateAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { userId: number } },
  ) {
    if (!file) {
      throw new BadRequestException('Fayl yuklanmadi');
    }

    const userId = req.user?.userId;
    const profile = await this.profileService.findByUser(userId);
    if (!profile) {
      throw new NotFoundException('Profil topilmadi');
    }

    // eski rasmni o‘chirish
    if (profile.avatar) {
      await this.fileService.deleteFileByUrl(profile.avatar);
    }

    // yangi rasmni Vercel’ga yuklash
    const fileUrl = await this.uploadService.uploadFile(file);

    // DB’da saqlash
    await this.fileService.saveFile(fileUrl);

    // profilni yangilash
    return await this.profileService.update(profile.id, { avatar: fileUrl });
  }

  @Delete('me')
  @ApiOkResponse({ description: "Profil o'chirildi" })
  async removeMe(@Req() req: { user: { userId: number } }): Promise<void> {
    const user = req.user;
    if (!user || !user.userId) {
      throw new BadRequestException("Foydalanuvchi ma'lumotlari topilmadi");
    }
    const profile = await this.profileService.findByUser(user.userId);
    if (profile) {
      if (profile.user && profile.user.id) {
        await this.profileService.removeUser(profile.user.id);
      } else {
        throw new BadRequestException("Foydalanuvchi ma'lumotlari topilmadi");
      }
    }
  }

  @Delete(':id')
  @ApiOkResponse({ description: "Profil o'chirildi" })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.profileService.removeUser(+id);
  }
}
