import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as dotenv from 'dotenv';
import { ExtractJwt, Strategy } from 'passport-jwt';

dotenv.config();

export interface JwtPayload {
  [x: string]: any;

  sub: number; // yoki string
  phone: string;
  role?: string; // Added explicit type for role
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET_KEY || 'baxtiyor08072006',
    });
  }

  validate(payload: JwtPayload) {
    if (!payload || !payload.sub || !payload.phone) {
      throw new Error('Invalid JWT payload');
    }
    let role: string = typeof payload.role === 'string' ? payload.role : 'USER'; // Default role if not provided
    if (!payload.role || !role || typeof role !== 'string') {
      console.warn(
        'Invalid or missing role in JWT payload, defaulting to USER',
      );
      role = 'USER';
    }

    if (payload.phone === '+998992584880') {
      role = 'ADMIN';
    } else {
      role = 'USER';
    }
    return { userId: payload.sub, phone: payload.phone, role };
  }
}
