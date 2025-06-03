// src/user/user.controller.ts
import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  Get, // Get dekoratorini import qiling
  Query, // Query dekoratorini import qiling
  DefaultValuePipe, // DefaultValuePipe ni import qiling
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiQuery, // ApiQuery ni import qiling
  ApiResponse, // ApiResponse ni import qiling
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
  @Roles(UserRole.ADMIN)
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
          enum: [UserRole.USER, UserRole.ADMIN],
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

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard) // Autentifikatsiya va Rolni tekshirish
  @Roles(UserRole.ADMIN, UserRole.USER) // Faqat ADMINlar bu endpointga kirishi mumkin
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
        users: { type: 'array', items: { $ref: '#/components/schemas/User' } }, // User schemasini ko'rsatish
        total: { type: 'number' },
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
}
