import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './../common/jwt/jwt.strategy';
import { Profile } from './../profile/enities/profile.entity';
import { ProfileService } from './../profile/profile.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';
import { Region } from './../location/entities/region.entity';
import { District } from './../location/entities/district.entity';
import { Product } from './../product/entities/product.entity';
import { Like } from './../like/entities/like.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Region,
      District,
      Product,
      Like,
      UserSearch,
    ]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY || 'baxtiyor08072006',
      signOptions: { expiresIn: '7d' },
    }),
    HttpModule,
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService, ProfileService],
  exports: [AuthService],
})
export class AuthModule {}
