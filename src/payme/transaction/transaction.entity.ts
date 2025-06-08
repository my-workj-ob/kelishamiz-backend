import { User } from "./../../auth/entities/user.entity";
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

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
  @Index()
  userId: number; // Agar relation to‘g‘ri ishlasa, bu ustun kerak emas

  @Column({ default: 'pending' })
  @Index()
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
  paymeTimeMs: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
