import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from './category.entity';

@Entity()
export class Property {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  type: string; // STRING, INTEGER, BOOLEAN, DOUBLE, etc.

  @ManyToOne(() => Category, (category) => category.properties)
  category: Category;
}
