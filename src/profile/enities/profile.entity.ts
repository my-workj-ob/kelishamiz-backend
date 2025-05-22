import {
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity';
import { Comment } from './../../comments/entities/comments.entity';
import { Like } from './../../like/entities/like.entity';
import { Product } from './../../product/entities/product.entity';
import { Region } from 'src/location/entities/region.entity';
import { District } from 'src/location/entities/district.entity';

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

  @OneToOne(() => Region, { nullable: true })
  @JoinColumn({ name: 'regionId' }) // 👈 Shu joy MUHIM
  region?: Region;

  @OneToOne(() => District, { nullable: true })
  @JoinColumn({ name: 'districtId' }) // 👈 Shu ham MUHIM
  district?: District;

  @Column({ nullable: true })
  address?: string; // Manzil

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

  // Boshqa profilga oid maydonlar (rasm, bio va hokazo)
}
