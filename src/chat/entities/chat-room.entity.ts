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

  @ManyToOne(() => Product, (product) => product.chatRooms, {
    onDelete: 'CASCADE',
  })
  product: Product;
  @ManyToMany(() => User, (user) => user.chatRooms, { cascade: true })
  @JoinTable({
    name: 'user_chat_rooms_chat_room',
    joinColumn: { name: 'userId', referencedColumnName: 'id' }, // Bu ChatRoom egasi (sizda ChatRoom), lekin hozir userId deb qo'yilgan, lekin aslida bu ChatRoomId bo'lishi kerak
    inverseJoinColumn: { name: 'chatRoomId', referencedColumnName: 'id' },
  })
  participants: User[];

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
