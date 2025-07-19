    
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
  imageUrl: string; // Cloudinary orqali yuklangan rasm URL

  @Column({ nullable: true })
  linkUrl: string;

  @Column({ default: 0 })
  order: number; // Ko'rsatilish tartibi

  @Column({ default: true })
  isActive: boolean; // Faol/nofaollik

  @Column({ default: 'home_hero' }) // Banner joylashuvi (masalan: home_hero, category_sidebar)
  placement: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
