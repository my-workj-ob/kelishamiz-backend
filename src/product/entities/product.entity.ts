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
import { ProductProperty } from './product-property-entity';
import { ProductImage } from './Product-Image.entity';
import { ChatRoom } from './../../chat/entities/chat-room.entity';
@Entity()
export class Product {
  @ApiProperty({ example: 1, description: 'Mahsulotning noyob identifikatori' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'iPhone 13 Pro Max', description: 'Mahsulot nomi' })
  @Column()
  title: string;

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

  @ManyToOne(() => Profile, (profile) => profile.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;
  //
  @Column({ nullable: true })
  profileId: number;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images: ProductImage[]; // Rasmlar uchun yangi relation

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

  @Column({ nullable: true })
  viewCount: number;

  @ApiProperty({ example: 'Toshkent', description: 'Mahsulot joylashuvi' })
  @Column()
  location: string;

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

  @ManyToMany(() => User, (user) => user.likes)
  likes: User[];

  @ManyToOne(() => Region, (region) => region.products, { eager: true })
  @JoinColumn({ name: 'regionId' })
  region: Region;

  @Column({ nullable: true })
  regionId: number;

  @ManyToOne(() => District, (district) => district.products, { eager: true })
  @JoinColumn({ name: 'districtId' })
  district: District;

  @Column({ nullable: true })
  districtId: number;

  @Column({ default: false })
  ownProduct: boolean;

  @Column({ default: 0, nullable: true })
  imageIndex: number;

  // Ushbu mahsulotga tegishli chat xonalari
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
