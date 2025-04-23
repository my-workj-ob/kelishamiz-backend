import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from './category.entity';

export enum PropertyType {
  STRING = 'STRING',
  INTEGER = 'INTEGER',
  DOUBLE = 'DOUBLE',
  BOOLEAN = 'BOOLEAN',
  SELECT = 'SELECT',
}

@Entity()
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true, enum: PropertyType })
  type: PropertyType;

  @ManyToOne(() => Category, (category) => category.properties)
  category: Category;

  @Column({ type: 'simple-array', nullable: true })
  options?: string[]; // faqat SELECT uchun
}
