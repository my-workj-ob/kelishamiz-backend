import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity'; // User entity joylashgan yo'lni to'g'rilang

@Entity('transactions')
@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  paymeTransactionId: string;

  @Column()
  amount: number;

  @ManyToOne(() => User, (user) => user.transactions)
  user: User;

  @Column({ default: 'pending' })
  status: 'pending' | 'success' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
// 