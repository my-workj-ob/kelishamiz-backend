// src/product/entities/product-view.entity.ts
import { User } from './../../auth/entities/user.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity()
export class UserViewedProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.views, { onDelete: 'CASCADE' })
  product: Product;

  @ManyToOne(() => User, (user) => user.viewedProducts, { nullable: true })
  user: User | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  device: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  browser: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  os: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  utm: string;

  @Column({ type: 'timestamptz' })
  viewedAt: Date;
}
