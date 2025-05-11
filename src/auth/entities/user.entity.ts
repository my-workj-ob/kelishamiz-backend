import {
  Column,
  Entity,
  ManyToMany,
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

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true, unique: true })
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
  viewedProducts: UserViewedProduct[];

  @OneToMany(() => UserSearch, (search) => search.user)
  searches: UserSearch[];
  @Column({ nullable: true })
  location: string; // Mana bu qatorni qo'shing
}
