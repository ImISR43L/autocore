import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
  CreateDateColumn, // <--- Importar
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';
import { Announcement } from '../../announcements/entities/announcement.entity';

@Entity()
export class Classroom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  // --- NOVA COLUNA NECESSÁRIA PARA ORDENAÇÃO ---
  @CreateDateColumn()
  createdAt: Date;
  // ---------------------------------------------

  @ManyToOne(() => User, (user) => user.ownedClassrooms)
  owner: User;

  @ManyToMany(() => User, (user) => user.joinedClassrooms)
  @JoinTable()
  students: User[];

  @OneToMany(() => Problem, (problem) => problem.classroom)
  problems: Problem[];

  @OneToMany(() => Announcement, (announcement) => announcement.classroom)
  announcements: Announcement[];
}
