// src/user/user.controller.ts
import {
  Controller,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from './../auth/entities/user.entity'; // UserRole enum yo'li
import { Roles } from './../common/interceptors/roles/role.decorator';
import { RolesGuard } from './../common/interceptors/roles/roles.guard';

class UpdateUserRoleDto {
  role: UserRole; // Yangi rol
}

@ApiTags('Users') // Swagger hujjatlarida Userlar kategoriyasi
@ApiBearerAuth() // Bu controllerdagi endpointlar JWT token talab qilishini bildiradi
@Controller('users') // Endpoint prefiksi 'users' bo'ladi (user emas, ko'plik odatiy hol)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch(':id/role')
  @UseGuards(AuthGuard('jwt'), RolesGuard) // Autentifikatsiya va Rolni tekshirish
  @Roles(UserRole.ADMIN) // Faqat ADMINlar bu endpointga kirishi mumkin
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
    @Param('id', ParseIntPipe) userId: number, // URL dagi ID ni number ga o'tkazish
    @Body() updateUserRoleDto: UpdateUserRoleDto, // So'rov body'sidan yangi rolni olish
  ) {
    // Kelgan rolni tekshirish, UserRole enumida mavjudligiga ishonch hosil qilish
    if (!Object.values(UserRole).includes(updateUserRoleDto.role)) {
      throw new BadRequestException('Invalid user role provided.');
    }

    // Rolni yangilash service metodini chaqirish
    const updatedUser = await this.userService.updateUserRole(
      userId,
      updateUserRoleDto.role,
    );

    return {
      message: 'User role updated successfully',
      user: updatedUser,
    };
  }
}
