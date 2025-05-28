import { ApiProperty } from '@nestjs/swagger';
import { User } from './../../auth/entities/user.entity';
import { Profile } from './../../profile/enities/profile.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
export type NotificationType =
  | 'NEW_CONNECTION'
  | 'MESSAGE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONNECTION_REMOVED'
  | 'OTHER'
  | 'CONNECTION_REQUEST';

@Entity('notifications')
export class Notification {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1 })
  @Column()
  userId: number; // Bu kolonni saqlab qolishingiz mumkin, lekin quyidagi relatsiya yanada yaxshi yechim

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, (user) => user.notifications)
  @JoinColumn({ name: 'userId' }) // Tashqi kalit kolonining nomi
  user: User;

  @ApiProperty({
    enum: [
      'NEW_CONNECTION',
      'MESSAGE',
      'ACCEPTED',
      'REJECTED',
      'CONNECTION_REMOVED',
      'OTHER',
      'CONNECTION_REQUEST',
    ],
    example: 'NEW_CONNECTION',
  })
  @Column({
    type: 'enum',
    enum: [
      'NEW_CONNECTION',
      'MESSAGE',
      'ACCEPTED',
      'REJECTED',
      'CONNECTION_REMOVED',
      'OTHER',
      'CONNECTION_REQUEST',
    ],
  })
  type: NotificationType;

  @ApiProperty({ type: () => Profile })
  @ManyToOne(() => Profile, (profile) => profile.notification)
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column({ nullable: true })
  profileId: number; // Tashqi kalit koloni

  @ApiProperty({ example: "Yangi do'stlik so'rovi!" })
  @Column()
  message: string;

  @ApiProperty({ example: 5, nullable: true })
  @Column({ nullable: true })
  relatedId?: number;

  @ApiProperty({ example: false })
  @Column({ default: false })
  isRead: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
