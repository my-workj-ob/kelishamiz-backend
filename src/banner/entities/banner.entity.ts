    
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  imageUrl: string;
  @Column({ nullable: true })
  linkUrl: string;

  @Column({ default: 0 })
  order: number; 

  @Column({ default: true })
  isActive: boolean; 

  @Column({ default: 'home_hero' }) 
  placement: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
