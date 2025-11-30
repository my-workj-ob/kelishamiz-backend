import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('security')
export class Security {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  privacyPolicy: string;

  @Column({ type: 'text' })
  terms: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
