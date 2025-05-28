import { User } from './../../auth/entities/user.entity';
import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class UserViewedProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.viewedProducts, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Product)
  product: Product;

  @CreateDateColumn()
  viewedAt: Date;
}
