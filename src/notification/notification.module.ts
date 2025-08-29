import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationController } from './notification.controller';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from 'firebase.service';
import { NotificationsService } from './notification.service';
import { User } from 'src/auth/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationsService, ConfigService, FirebaseService],
  controllers: [NotificationController],
  exports: [NotificationsService, FirebaseService],
})
export class NotificationModule {}
