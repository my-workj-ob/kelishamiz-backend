import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity';
import { Category } from './../../category/entities/category.entity';
import { Property } from './../../category/entities/property.entity';
import { Profile } from './../../profile/enities/profile.entity';

@Entity()
export class Product {
  @ApiProperty({ example: 1, description: 'Mahsulotning noyob identifikatori' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'iPhone 13 Pro Max', description: 'Mahsulot nomi' })
  @Column()
  title: string;

  @ApiProperty({
    example: "Eng so'nggi iPhone modeli...",
    description: 'Mahsulotning batafsil tavsifi',
  })
  @Column('text')
  description: string;

  @ApiProperty({ example: 1299.99, description: 'Mahsulot narxi' })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ManyToOne(() => Profile, (profile) => profile.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column({ nullable: true })
  profileId: number;

  @ApiProperty({
    example: 'https://example.com/main.jpg',
    description: 'Asosiy rasm manzili',
  })
  @Column()
  mainImage: string;

  @ApiProperty({
    example: ['https://example.com/image1.jpg'],
    description: "Qo'shimcha rasmlar manzillari",
    required: false,
  })
  @Column('simple-array', { nullable: true })
  images: string[];

  @ApiProperty({
    type: () => Category,
    description: "Mahsulot tegishli bo'lgan kategoriya",
  })
  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @ApiProperty({
    example: 1,
    description: "Mahsulot tegishli bo'lgan kategoriya IDsi",
  })
  @Column()
  categoryId: number;

  @ApiProperty({ example: 'Toshkent', description: 'Mahsulot joylashuvi' })
  @Column()
  location: string;

  @ApiProperty({
    type: () => [Property],
    description: 'Mahsulotning xususiyatlari',
    required: false,
  })
  @ManyToMany(() => Property)
  @JoinTable({
    name: 'product_properties',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'propertyId', referencedColumnName: 'id' },
  })
  properties: Property[];

  @ApiProperty({
    example: { Color: 'Qora', Memory: '256 GB' },
    description: 'Mahsulot xususiyatlarining qiymatlari',
    required: false,
  })
  @Column('jsonb', { nullable: true })
  propertyValues: Record<string, any>;

  @Column()
  paymentType: string;

  @Column()
  currencyType: string;

  @Column({ default: false })
  negotiable: boolean;

  @Column({ default: 0 })
  likesCount: number;

  @Column({ default: 0 })
  commentsCount: number;

  @ManyToMany(() => User, (user) => user.likedProjects)
  @JoinTable()
  likes: User[];

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  }) // Avtomatik ravishda yangilanish vaqtini qo'yadi
  updatedAt: Date;

  @ApiProperty({
    example: '2025-04-16T13:45:00.000Z',
    description: 'Mahsulot yaratilgan vaqti',
  })
  @CreateDateColumn()
  createdAt: Date;
}
