// src/common/interceptors/roles/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './../../../auth/entities/user.entity'; // UserRole yo'lini tekshiring!
import { ROLES_KEY } from './role.decorator'; // role.decorator dagi kalitni import qiling

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Dekorator orqali belgilangan rollarni olish
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Agar `@Roles` dekoratori ishlatilmagan bo'lsa, hammaga ruxsat berish
    if (!requiredRoles) {
      return true;
    }

    // 2. Foydalanuvchi ma'lumotlarini olish
    const { user } = context.switchToHttp().getRequest();

    // Konsolga ma'lumotlarni chiqarish (debug uchun)
    console.log('RolesGuard: Required Roles:', requiredRoles);
    console.log('RolesGuard: User from request:', user); // `user` obyekti to'g'ri kelayotganini tekshiring
    console.log('RolesGuard: User Role:', user?.role); // User roli mavjudligini tekshiring

    // 3. Foydalanuvchining rolini tekshirish
    // Agar foydalanuvchi mavjud bo'lsa va uning roli requiredRoles ichida bo'lsa, ruxsat berish
    return requiredRoles.some((role) => user?.role === role);
  }
}
