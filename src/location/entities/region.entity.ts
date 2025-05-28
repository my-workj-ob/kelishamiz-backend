// region.entity.ts
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './../../product/entities/product.entity';
import { District } from './district.entity';
import { Profile } from './../../profile/enities/profile.entity';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => District, (district) => district.region)
  districts: District[];
  @OneToMany(() => Product, (product) => product.region)
  products: Product[];
  // region.entity.ts
  @OneToMany(() => Profile, (profile) => profile.region)
  profiles: Profile[];
}
