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
  order: number; // Order maydoni image index bilan bog'liq bo'lsa, uni nullable qoldirish kerak

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' }) // <-- BU QATORNI HAM QO'SHING, agar productId ustuni bo'lmasa.
  // Sizning Product entityingizda images relationida productId bor edi.
  // Agar ProductImage entity-sida productId ustuni mavjud bo'lmasa,
  // TypeORM avtomatik nom berishi mumkin, ammo aniqlik uchun qo'shish yaxshi.
  @Exclude({ toPlainOnly: true }) // <-- BU QATORNI QO'SHING
  product: Product;

  // Agar ProductImage entity-sida productId ustuni bo'lsa, uni ham qo'shing.
  @Column({nullable: true})
  productId: number;
}
