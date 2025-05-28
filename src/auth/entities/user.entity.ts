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
import { UserViewedProduct } from './../../product/entities/product-view.entity';
import { Region } from './../../location/entities/region.entity';
import { District } from './../../location/entities/district.entity';
import { ChatRoom } from './../../chat/entities/chat-room.entity';
import { Message } from './../../chat/entities/message.entity';
import { Notification } from './../../notification/entities/notification.entity';

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

  @ManyToMany(() => Product, (product) => product.likes)
  @JoinTable({
    name: 'product_likes_user',
    joinColumn: {
      name: 'userId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'productId',
      referencedColumnName: 'id',
    },
  })
  likes: Product[];

  @OneToMany(() => UserViewedProduct, (viewProduct) => viewProduct.user, {
    cascade: true,
  })
  @JoinTable()
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
