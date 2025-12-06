import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Exclude } from 'class-transformer'; // <-- BU IMPORTNI QO'SHING

@Entity()
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column({ nullable: true })
  order: number; 

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' }) 
  @Exclude({ toPlainOnly: true }) 
  product: Product;

  @Column({nullable: true})
  productId: number;
}
