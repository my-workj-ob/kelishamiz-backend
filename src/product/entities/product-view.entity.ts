import { User } from './../../auth/entities/user.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'user_viewed_product' })
export class UserViewedProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.views, { onDelete: 'CASCADE' })
  product: Product;

  @ManyToOne(() => User, (user) => user.viewedProducts, { nullable: true })
  user: User | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'ip' })
  ip: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'device' })
  device: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'country' })
  country: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'browser' })
  browser: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'os' })
  os: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'utm' })
  utm: string | null;

  @Column({ type: 'timestamptz', name: 'viewed_at' })
  viewedAt: Date;
}
