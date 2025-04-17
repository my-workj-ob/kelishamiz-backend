import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity';

@Entity('user_searches')
export class UserSearch {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.searches)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  query: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
