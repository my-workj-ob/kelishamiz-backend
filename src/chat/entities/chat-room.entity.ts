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

  @ManyToMany(() => User, (user) => user.chatRooms, { cascade: true })
  @JoinTable({
    name: 'chat_room_participants_user', // aniq jadval nomi
    joinColumn: {
      name: 'chatRoomId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'userId',
      referencedColumnName: 'id',
    },
  })
  participants: User[];

  // Ushbu chat xonasidagi barcha xabarlar
  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @CreateDateColumn({ name: 'createdat' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt: Date;
}
