import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './../../product/entities/product.entity';
import { Region } from './region.entity';

@Entity()
export class District {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // @ManyToOne(() => Region, (region) => region.districts, {
  //   onDelete: 'CASCADE',
  // })
  // @JoinColumn({ name: 'regionId' })
  // region: Region;

  // @Column()
  // regionId: number;
  // @OneToMany(() => Product, (product) => product.district)
  // products: Product[];
}
