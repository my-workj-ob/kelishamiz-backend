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
  @ManyToMany(() => Product, (project) => project.likes)
  likedProjects: Product[];

  @OneToMany(() => Like, (like) => like.user, { cascade: true })
  likes: Like[];
}
