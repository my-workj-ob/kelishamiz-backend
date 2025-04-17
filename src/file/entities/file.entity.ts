import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class FileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'url' })
  url: string;

  @CreateDateColumn()
  uploadedAt: Date;
}
