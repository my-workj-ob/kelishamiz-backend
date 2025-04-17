import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from 'src/common/jwt/jwt.strategy';
import { Profile } from 'src/profile/enities/profile.entity';
import { ProfileService } from 'src/profile/profile.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { OtpService } from './fake-otp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY || 'baxtiyor08072006',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService, ProfileService],
})
export class AuthModule {}
