import { User } from './../../auth/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  paymeTransactionId: string;

  @Column({ type: 'integer' })
  @Index()
  userId: number;

  @ManyToOne(() => User, (user) => user.transactions)
  user: User;

  @Column({ type: 'varchar', nullable: true })
  paymeTime: string;

  @Column({ type: 'bigint' })
  paymeTimeMs: number;

  @Column({ type: 'varchar', nullable: true })
  reason: string;

  @Column({ type: 'bigint', nullable: true })
  amount: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
// ok
  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @Column({
    type: 'enum',
    enum: [
      'pending',
      'success',
      'failed',
      'cancelled',
      'cancelled_with_revert',
    ],
    default: 'pending',
  })
  @Index()
  status:
    | 'pending'
    | 'success'
    | 'failed'
    | 'cancelled'
    | 'cancelled_with_revert';
}
