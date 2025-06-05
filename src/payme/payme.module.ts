import { Module } from '@nestjs/common';
import { PaymeController } from './payme.controller';
import { PaymeService } from './payme.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction/transaction.entity';
import { User } from './../auth/entities/user.entity';
import { PaymeAuthInterceptor } from './auth.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forFeature([Transaction, User]),
  ],
  controllers: [PaymeController],
  providers: [PaymeService, PaymeAuthInterceptor],
})
export class PaymeModule {}
