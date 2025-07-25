import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Property } from '../../category/entities/property.entity';
import { Product } from './product.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class ProductProperty {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.productProperties, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  @Exclude()
  product: Product;

  @Column({ nullable: true })
  productId: number;

  @ManyToOne(() => Property, { eager: true })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column()
  propertyId: number;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column('jsonb')
  value: Record<string, any>;
}
