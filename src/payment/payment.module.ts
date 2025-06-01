import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment } from './entities/payme.entity';
import { ConfigModule } from '@nestjs/config';
import { User } from './../auth/entities/user.entity';
import { ProfileService } from './../profile/profile.service';
import { Profile } from './../profile/enities/profile.entity';
import { Product } from './../product/entities/product.entity';
import { Like } from './../like/entities/like.entity';
import { UserSearch } from './../search-filter/entities/user-search.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Payment,
      User,
      Profile,
      Product,
      Like,
      UserSearch,
    ]),
  ],
  providers: [PaymentService, ProfileService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
