    
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './../../../auth/entities/user.entity'; // UserRole yo'lini tekshiring!
import { ROLES_KEY } from './role.decorator'; // role.decorator dagi kalitni import qiling

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    
    if (!requiredRoles) {
      return true;
    }

    
    const { user } = context.switchToHttp().getRequest();

    
    console.log('RolesGuard: Required Roles:', requiredRoles);
    console.log('RolesGuard: User from request:', user); // `user` obyekti to'g'ri kelayotganini tekshiring
    console.log('RolesGuard: User Role:', user?.role); // User roli mavjudligini tekshiring

    
    
    return requiredRoles.some((role) => user?.role === role);
  }
}
