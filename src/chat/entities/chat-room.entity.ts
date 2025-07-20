// src/entities/chat-room.entity.ts
import { User } from 'src/auth/entities/user.entity';
import { Product } from 'src/product/entities/product.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'productid' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.chatRooms)
  product: Product;

  // Bu chat xonasida qatnashuvchi foydalanuvchilar (ko'pincha 2ta bo'ladi: mahsulot egasi va sotib oluvchi)
  @ManyToMany(() => User, (user) => user.chatRooms, { cascade: true }) // cascade: true foydalanuvchilar yaratilganda ularni bog'lashga yordam beradi
  @JoinTable() // Bu jadval ManyToMany munosabati uchun qo'shimcha jadval yaratadi
  participants: User[];

  // Ushbu chat xonasidagi barcha xabarlar
  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @CreateDateColumn({ name: 'createdat' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt: Date;
}
