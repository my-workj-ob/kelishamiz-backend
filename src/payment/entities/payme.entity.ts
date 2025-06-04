import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from 'src/auth/entities/user.entity';
export enum PaymentStatus {
  Pending = 'pending',
  Created = 'created',
  Completed = 'completed',
  ToppedUp = 'topped_up',
  Withdrawn = 'withdrawn',
  Review = 'review',
  Cancelled = 'cancelled',
}
@Entity()
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'To‘lov ID', example: 'uuid-1234-5678' })
  id: string; // UUID bo'lsa string

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  user_id: number; // Number bo'lsa number

  @Column({ nullable: true })
  @ApiProperty({
    description: 'E‘lon ID',
    example: 'announcement456',
    required: false,
  })
  announcement_id: number; // Number bo'lsa number

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Profil ID',
    example: 'profile789',
    required: false,
  })
  profile_id: number; // Number bo'lsa number

  @Column()
  @ApiProperty({ description: 'To‘lov summasi (so‘m)', example: 100000 })
  amount: number;

  @Column()
  @ApiProperty({ description: 'To‘lov summasi (tiyinda)', example: 10000000 })
  amount_in_tiyin: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    nullable: true,
  })
  @ApiProperty({
    description: 'To‘lov holati',
    example: PaymentStatus.Pending,
    enum: PaymentStatus,
  })
  status?: PaymentStatus;
  @Column({ nullable: true })
  @ApiProperty({ description: 'Payme tranzaksiya ID', example: 'trans123' })
  payme_transaction_id?: string; // String bo'lsa string (bu to'g'ri)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({
    description: 'Yaratilgan vaqt',
    example: '2025-06-01T17:46:00+05:00',
  })
  created_at: Date;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({
    description: 'Yaratilgan vaqt',
    example: '2025-06-01T17:46:00+05:00',
  })
  updated_at: Date;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Kimdan (manba hisobi)',
    example: '90 117 90 90',
  })
  from_account: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Kimga (qabul qiluvchi hisobi)',
    example: '90 117 90 90',
  })
  to_account: string;

  @Column({ type: 'enum', enum: ['in', 'out'], default: 'in' })
  @ApiProperty({
    description: 'Kirim yoki chiqim',
    example: 'in',
    enum: ['in', 'out'],
  })
  transaction_type: string;

  @Column({ type: 'enum', enum: ['payme_card', 'click_card'], nullable: true })
  @ApiProperty({
    description: 'To‘lov usuli',
    example: 'payme_card',
    enum: ['payme_card', 'click_card'],
  })
  payment_method: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Qaytish URL si',
    example: 'https://your-site.com/payment/callback',
  })
  callback_url: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Xavfsizlik imzo', example: 'hashed_signature' })
  signature: string;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({ description: 'Validatsiya holati', example: false })
  is_validated: boolean;
  @Column({ nullable: true })
  @ApiProperty({
    description: 'To‘lov rad etilgan sababi yoki izoh',
    example: 'Insufficient funds',
    required: false,
  })
  reason?: string;
}
