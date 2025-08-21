import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  Get,
  Query,
  DefaultValuePipe,
  Delete, // <-- Delete dekoratorini import qiling
  HttpCode, // <-- HttpCode dekoratorini import qiling
  HttpStatus,
  Req, // <-- HttpStatus ni import qiling
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from './../auth/entities/user.entity';
import { Roles } from './../common/interceptors/roles/role.decorator';
import { RolesGuard } from './../common/interceptors/roles/roles.guard';

class UpdateUserRoleDto {
  role: UserRole;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch(':id/role')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN) // FAQAT ADMINLAR rolini yangilashi mumkin
  @ApiOperation({
    summary: 'Foydalanuvchining rolini yangilash (faqat admin uchun)',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Foydalanuvchi IDsi' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: [UserRole.USER, UserRole.ADMIN], // SUPER_ADMIN ni ham qo'shing agar mavjud bo'lsa
          example: UserRole.ADMIN,
        },
      },
      required: ['role'],
    },
    description: 'Yangi foydalanuvchi roli',
  })
  async updateRole(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ) {
    if (!Object.values(UserRole).includes(updateUserRoleDto.role)) {
      throw new BadRequestException('Invalid user role provided.');
    }

    const updatedUser = await this.userService.updateUserRole(
      userId,
      updateUserRoleDto.role,
    );

    return {
      message: 'User role updated successfully',
      user: updatedUser,
    };
  }
// 
  @Patch('token/notification')
  async updateToken(
    @Req() req: { user: { userId: number } },
    @Body('token') token: string,
  ) {
    if (!req.user?.userId) throw new Error('User not found');
    return this.userService.updateToken(req.user.userId, token);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN) // FAQAT ADMINLAR barcha foydalanuvchilarni ko'rishi mumkin
  @ApiOperation({
    summary: 'Barcha foydalanuvchilar roʻyxatini olish (faqat admin uchun)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Sahifa raqami',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Sahifadagi elementlar soni',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Foydalanuvchilar roʻyxati muvaffaqiyatli olindi.',
    schema: {
      type: 'object',
      properties: {
        users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        total: { type: 'number' },
        page: { type: 'number' }, // Qo'shildi
        pageSize: { type: 'number' }, // Qo'shildi
        totalPages: { type: 'number' }, // Qo'shildi
        message: { type: 'string' }, // Qo'shildi
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Ruxsatsiz kirish.' })
  @ApiResponse({
    status: 403,
    description: 'Ruxsat yoʻq (faqat adminlar uchun).',
  })
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ) {
    if (page <= 0 || pageSize <= 0) {
      throw new BadRequestException(
        'Sahifa va sahifa hajmi musbat sonlar boʻlishi kerak.',
      );
    }

    const { users, total } = await this.userService.findAllUsers(
      page,
      pageSize,
    );

    return {
      message: 'Users retrieved successfully',
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  @Delete(':id') // <-- Yangi DELETE endpoint
  @ApiOperation({
    summary: 'Foydalanuvchini oʻchirish (faqat admin uchun)',
    description: 'Berilgan ID boʻyicha foydalanuvchini oʻchiradi.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Oʻchiriladigan foydalanuvchi IDsi',
  })
  @ApiResponse({
    status: 204,
    description: 'Foydalanuvchi muvaffaqiyatli oʻchirildi.',
  })
  @ApiResponse({ status: 404, description: 'Foydalanuvchi topilmadi.' })
  @ApiResponse({ status: 401, description: 'Ruxsatsiz kirish.' })
  @ApiResponse({
    status: 403,
    description: 'Ruxsat yoʻq (faqat adminlar uchun).',
  })
  @HttpCode(HttpStatus.NO_CONTENT) // Muvaffaqiyatli o'chirilganda 204 No Content statusini qaytaradi
  async deleteUser(@Param('id', ParseIntPipe) userId: number): Promise<void> {
    await this.userService.deleteUser(userId);
  }
}
