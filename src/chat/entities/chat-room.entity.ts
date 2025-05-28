// src/entities/chat-room.entity.ts
import { User } from './../../auth/entities/user.entity';
import { Product } from './../../product/entities/product.entity';
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
  JoinColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.chatRooms)
  product: Product;

  // Bu chat xonasida qatnashuvchi foydalanuvchilar (ko'pincha 2ta bo'ladi: mahsulot egasi va sotib oluvchi)
  @ManyToMany(() => User, (user) => user.chatRooms, { cascade: true }) // cascade: true foydalanuvchilar yaratilganda ularni bog'lashga yordam beradi
  @JoinTable() // Bu jadval ManyToMany munosabati uchun qo'shimcha jadval yaratadi
  participants: User[];

  // Ushbu chat xonasidagi barcha xabarlar
  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
