/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
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

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Profil yaratildi', type: Profile })
  async create(
    @Body() createProfileDto: CreateProfileDto,
    @Req() req: any, // Req tipini any yoki mos keladigan Request tipiga o'zgartiring
  ): Promise<Profile> {
    const user = req.user; // Payload user obyektida bo'lishi mumkin
    return await this.profileService.create(createProfileDto);
  }

  @Get()
  @ApiOkResponse({ description: "Barcha profillar ro'yxati", type: [Profile] })
  async findAll(): Promise<Profile[]> {
    return await this.profileService.findAll();
  }

  @Get('me')
  @ApiOkResponse({ description: 'Foydalanuvchining profili', type: Profile })
  async getMe(@Req() req: any): Promise<Profile> {
    const user = req.user;
    const existUser = await this.profileService.findByUser(user.userId);
    if (!existUser) {
      throw new NotFoundException('Foydalanuvchi profili topilmadi');
    }
    return existUser;
  }

  @Get(':id')
  @ApiOkResponse({ description: "Profil ma'lumotlari", type: Profile })
  async findOne(@Param('id') id: string): Promise<Profile> {
    return await this.profileService.findOne(+id);
  }

  @Patch('me')
  @ApiOkResponse({ description: 'Profil yangilandi', type: Profile })
  async updateMe(
    @Body() updateProfileDto: UpdateProfileDto,
    @Req() req: any,
  ): Promise<Profile> {
    const user = req.user;
    const profile = await this.profileService.findByUser(user.id);
    if (!profile) {
      return await this.profileService.create(updateProfileDto);
    }
    return await this.profileService.update(profile.id, updateProfileDto);
  }

  @Delete('me')
  @ApiOkResponse({ description: "Profil o'chirildi" })
  async removeMe(@Req() req: any): Promise<void> {
    const user = req.user;
    const profile = await this.profileService.findByUser(user.id);
    if (profile) {
      await this.profileService.remove(profile.id);
    }
  }

  @Delete(':id')
  @ApiOkResponse({ description: "Profil o'chirildi" })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.profileService.remove(+id);
  }
}
