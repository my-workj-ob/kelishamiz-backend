import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notificationGateway';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from 'firebase.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [
    NotificationService,
    NotificationGateway,
    ConfigService,
    FirebaseService,
  ],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationGateway, FirebaseService],
})
export class NotificationModule {}
