import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comment } from './../../comments/entities/comments.entity';
import { Like } from './../../like/entities/like.entity';
import { Product } from './../../product/entities/product.entity';
import { Profile } from './../../profile/enities/profile.entity';
import { UserSearch } from './../../search-filter/entities/user-search.entity';
import { UserViewedProduct } from 'src/product/entities/product-view.entity';
import { Region } from 'src/location/entities/region.entity';
import { District } from 'src/location/entities/district.entity';
import { ChatRoom } from 'src/chat/entities/chat-room.entity';
import { Message } from 'src/chat/entities/message.entity';
import { Notification } from 'src/notification/entities/notification.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  phone: string;

  @Column({ unique: false })
  username?: string;

  @Column({ nullable: true })
  password?: string;

  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;

  @OneToMany(() => Comment, (comment) => comment.user, { cascade: true })
  comments: Comment[];

  @OneToMany(() => Like, (like) => like.user, { cascade: true })
  likes: Like[];

  @OneToMany(() => UserViewedProduct, (viewProduct) => viewProduct.user, {
    cascade: true,
  })
  @JoinTable() // <-- BU MUHIM
  viewedProducts: UserViewedProduct[];

  @OneToMany(() => UserSearch, (search) => search.user, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  searches: UserSearch[];

  @Column({ nullable: true })
  regionId?: number;

  @ManyToOne(() => Region, { nullable: true })
  @JoinColumn({ name: 'regionId' })
  region?: Region;

  @ManyToOne(() => District, { nullable: true })
  @JoinColumn({ name: 'districtId' })
  district?: District;

  @Column({ nullable: true })
  districtId?: number;
  // Foydalanuvchi ishtirok etgan chat xonalari
  @ManyToMany(() => ChatRoom, (chatRoom) => chatRoom.participants)
  chatRooms: ChatRoom[];

  // Foydalanuvchi yuborgan xabarlar
  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];
  // Foydalanuvchi yuborgan xabarlar
  @OneToMany(() => Notification, (message) => message.user)
  notifications: Notification[];
}
