// src/products/entities/product.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './../../auth/entities/user.entity';
import { Category } from './../../category/entities/category.entity';
import { Comment } from './../../comments/entities/comments.entity';
import { District } from './../../location/entities/district.entity';
import { Region } from './../../location/entities/region.entity';
import { Profile } from './../../profile/enities/profile.entity';
import { ProductProperty } from './product-property.entity';
import { ProductImage } from './Product-Image.entity';
import { ChatRoom } from './../../chat/entities/chat-room.entity';
import { Exclude, Expose } from 'class-transformer'; // <-- class-transformer importlari

@Entity()
export class Product {
  @ApiProperty({ example: 1, description: 'Mahsulotning noyob identifikatori' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'iPhone 13 Pro Max', description: 'Mahsulot nomi' })
  @Column()
  title: string;

  // Comment entity-sida `product`ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  // Bu yerda Product entity-si ichida Comment massivi bo'lishi normal.
  @OneToMany(() => Comment, (comment) => comment.profile, { cascade: true })
  comments?: Comment[];

  @ApiProperty({
    example: "Eng so'nggi iPhone modeli...",
    description: 'Mahsulotning batafsil tavsifi',
  })
  @Column('text')
  description: string;

  @ApiProperty({ example: 1299.99, description: 'Mahsulot narxi' })
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @ApiProperty({
    example: 1200.0,
    description: 'Minimal narx (agar mavjud bo‘lsa)',
  })
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minPrice: number;

  @ApiProperty({
    example: 1400.0,
    description: 'Maksimal narx (agar mavjud bo‘lsa)',
  })
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maxPrice: number;

  // Profil entity-sida `products` ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @ManyToOne(() => Profile, (profile) => profile.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column({ nullable: true })
  profileId: number;

  // ProductImage entity-sida `product`ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @OneToMany(() => ProductImage, (image) => image.product, {
    eager: true,
    cascade: true,
  })
  images: ProductImage[]; // Rasmlar uchun yangi relation

  @ApiProperty({
    type: () => Category,
    description: "Mahsulot tegishli bo'lgan kategoriya",
  })
  // Category entity-sida `products` ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
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

  @Column({ nullable: true })
  viewCount: number;

  // ProductProperty entity-sida `product`ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @OneToMany(
    () => ProductProperty,
    (productProperty) => productProperty.product,
    { cascade: true },
  )
  productProperties: ProductProperty[];

  @Column({ type: 'jsonb', nullable: true })
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

  // User entity-sida `likes` ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @ManyToMany(() => User, (user) => user.likes, { onDelete: 'CASCADE' })
  likes: User[];

  // Region entity-sida `products` ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @ManyToOne(() => Region, (region) => region.products, { eager: true })
  @JoinColumn({ name: 'regionId' })
  region: Region;

  @Column({ nullable: true })
  regionId: number;

  // District entity-sida `products` ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @ManyToOne(() => District, (district) => district.products, { eager: true })
  @JoinColumn({ name: 'districtId' })
  district: District;

  @Column({ nullable: true })
  districtId: number;

  @Column({ default: false })
  ownProduct: boolean;

  @Column({ type: 'int', default: 0, nullable: true })
  imageIndex: number;

  // ChatRoom entity-sida `product`ga qayta ishora bo'lsa, u yerda @Exclude() ishlatish kerak.
  @OneToMany(() => ChatRoom, (chatRoom) => chatRoom.product)
  chatRooms: ChatRoom[];

  @Column({ default: false })
  isTop: boolean;

  @Column({ default: false })
  isPublish: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  topExpiresAt: Date | null;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @ApiProperty({
    example: '2025-04-16T13:45:00.000Z',
    description: 'Mahsulot yaratilgan vaqti',
  })
  @CreateDateColumn()
  createdAt: Date;
}
