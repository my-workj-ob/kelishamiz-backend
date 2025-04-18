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

// ...

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

  // ✅ Yangi maydonlar: minPrice va maxPrice
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

  @OneToMany(
    () => ProductProperty,
    (productProperty) => productProperty.product,
    { cascade: true },
  )
  productProperties: ProductProperty[];

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
