    
    
    
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import * as dotenv from 'dotenv';
import { ExtractJwt, Strategy } from 'passport-jwt';

dotenv.config();

    
export interface JwtPayload {
  [x: string]: any;

  sub: number; // yoki string
  phone: string;
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
    return { userId: payload.sub, phone: payload.phone, role: payload.role };
  }
}
