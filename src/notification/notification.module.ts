import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationController } from './notification.controller';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from 'firebase.service';
import { NotificationsService } from './notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [NotificationsService, ConfigService, FirebaseService],
  controllers: [NotificationController],
  exports: [NotificationsService, FirebaseService],
})
export class NotificationModule {}
