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
  @Exclude() // bu maydon javobga kirmaydi
  product: Product;

  @Column()
  productId: number;

  @ManyToOne(() => Property, { eager: true })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Column()
  propertyId: number;

  @Column('jsonb')
  value: Record<string, string>;
}
