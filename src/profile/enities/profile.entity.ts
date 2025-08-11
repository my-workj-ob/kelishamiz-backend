import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity';
import { Comment } from './../../comments/entities/comments.entity';
import { Like } from './../../like/entities/like.entity';
import { Product } from './../../product/entities/product.entity';
import { Region } from './../../location/entities/region.entity';
import { District } from './../../location/entities/district.entity';
import { Notification } from './../../notification/entities/notification.entity';

@Entity()
export class Profile {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @ManyToOne(() => Region, (region) => region.profiles, { nullable: true })
  @JoinColumn({ name: 'regionId' })
  region?: Region;

  @Column({ nullable: true })
  regionId?: number;

  @ManyToOne(() => District, (district) => district.profiles, {
    nullable: true,
  })
  @JoinColumn({ name: 'districtId' })
  district?: District;

  @Column({ nullable: true })
  districtId?: number;

  @Column({ nullable: true })
  address?: string;
  @Column({ nullable: true })
  avatar?: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user?: User;

  @OneToMany(() => Product, (product) => product.profile)
  products?: Product[];

  @OneToMany(() => Comment, (comment) => comment.profile, { cascade: true })
  comments?: Comment[];

  @ManyToMany(() => Product, (product) => product.likes)
  likedProducts?: Product[];

  @OneToMany(() => Like, (like) => like.user, { cascade: true })
  likes?: Like[];
  @OneToMany(() => Notification, (notification) => notification.profile)
  notification: Notification[];
}
