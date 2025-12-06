    
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './../../../auth/entities/user.entity'; 
import { ROLES_KEY } from './role.decorator'; 

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
    console.log('RolesGuard: User from request:', user); 
    console.log('RolesGuard: User Role:', user?.role);

    
    
    return requiredRoles.some((role) => user?.role === role);
  }
}
