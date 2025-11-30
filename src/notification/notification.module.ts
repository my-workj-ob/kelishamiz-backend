import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationController } from './notification.controller';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notification.service';
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User, Product])],
  providers: [NotificationsService, ConfigService],
  controllers: [NotificationController],
  exports: [NotificationsService],
})
export class NotificationModule {}
