import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './../../product/entities/product.entity';
import { Property } from './property.entity';

@Entity()
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
  @Column({ nullable: true })
  imageUrl: string;

  @ManyToOne(() => Category, (category) => category.children, {
    onDelete: 'SET NULL',
  })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];
  @OneToMany(() => Property, (property) => property.category)
  properties: Property[]; // Bir nechta propertylarni ulash

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
