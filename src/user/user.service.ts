// src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './../auth/entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
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

    user.role = newRole;
    return this.usersRepository.save(user);
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

  /**
   * Barcha foydalanuvchilarni sahifalash bilan oladi.
   * @param page Sahifa raqami (default: 1).
   * @param pageSize Sahifadagi elementlar soni (default: 10).
   * @returns Foydalanuvchilar ro'yxati va umumiy soni.
   */
  async findAllUsers(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const [users, total] = await this.usersRepository.findAndCount({
      skip: skip,
      take: pageSize,
      select: ['id', 'phone', 'username', 'role', 'regionId', 'districtId'],
    });

    const usersWithoutPassword: Partial<User>[] = users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });

    return { users: usersWithoutPassword, total };
  }

  /**
   * Foydalanuvchini ID bo'yicha o'chiradi.
   * @param userId O'chiriladigan foydalanuvchining ID'si.
   */
  async deleteUser(userId: number): Promise<void> {
    const result = await this.usersRepository.delete(userId); // delete usulini chaqirish

    if (result.affected === 0) {
      // Agar ta'sirlangan qatorlar soni 0 bo'lsa, foydalanuvchi topilmagan
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
  }
}
