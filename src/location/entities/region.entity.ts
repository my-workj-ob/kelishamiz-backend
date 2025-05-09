// region.entity.ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './../../product/entities/product.entity';
import { District } from './district.entity';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  // @OneToMany(() => District, (district) => district.region)
  // districts: District[];
  // @OneToMany(() => Product, (product) => product.region)
  // products: Product[];
}
