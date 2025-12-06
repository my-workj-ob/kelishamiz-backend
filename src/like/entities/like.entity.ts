import { Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './../../auth/entities/user.entity';
import { Comment } from './../../comments/entities/comments.entity';

@Entity()
export class Like {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.likes, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Comment, (comment) => comment.likes, { onDelete: 'CASCADE' }) 
  comment: Comment;
}
