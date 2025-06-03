// src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './../auth/entities/user.entity'; // User entity va UserRole import qilingan

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) // UserRepository'ni inject qilamiz
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Foydalanuvchining rolini ID bo'yicha yangilaydi.
   * @param userId Yangilanadigan foydalanuvchining ID'si.
   * @param newRole Foydalanuvchiga beriladigan yangi rol (UserRole.ADMIN yoki UserRole.USER).
   * @returns Yangilangan foydalanuvchi obyekti.
   */
  async updateUserRole(userId: number, newRole: UserRole): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.role = newRole; // Rolni yangilash
    return this.usersRepository.save(user); // Ma'lumotlar bazasiga saqlash
  }

  /**
   * Foydalanuvchini ID bo'yicha qaytaradi.
   * @param userId Qidirilayotgan foydalanuvchining ID'si.
   * @returns Foydalanuvchi obyekti.
   */
  async findUserById(userId: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }
}
