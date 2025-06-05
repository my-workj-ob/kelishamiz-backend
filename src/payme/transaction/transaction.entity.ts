import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity'; // User entity joylashgan yo'lni to'g'rilang

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index()
  paymeTransactionId: string;

  @Column()
  amount: number;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: 'pending' })
  status:
    | 'pending'
    | 'success'
    | 'failed'
    | 'cancelled'
    | 'cancelled_with_revert';

  @Column({ nullable: true })
  paymeTime: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'bigint', nullable: true })
  paymeTimeMs?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
