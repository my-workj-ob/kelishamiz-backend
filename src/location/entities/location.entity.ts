import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('locations') // Table name in the database
export class Location {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ type: 'text', nullable: true })
  description?: string;
}
