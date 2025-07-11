// src/entities/message.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from './../../auth/entities/user.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable: true})
  chatRoomId: string;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chatRoomId' })
  chatRoom: ChatRoom;
  @Column()
  senderId: string; // Kim yuborgani (User ID)

  @ManyToOne(() => User, (user) => user.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' }) 
  sender: User;

  @Column('text') // Katta matnlar uchun 'text' tipi yaxshiroq
  content: string; // Xabar matni

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: false })
  read: boolean; // Xabar o'qilganligi holati
}
