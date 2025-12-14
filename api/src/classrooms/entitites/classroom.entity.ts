import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Problem } from '../../submissions/entities/problem.entity';

@Entity()
export class Classroom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string; // Código de convite (ex: "X7A9B2")

  @ManyToOne(() => User, (user) => user.ownedClassrooms)
  owner: User; // O Professor desta turma

  @ManyToMany(() => User, (user) => user.joinedClassrooms)
  @JoinTable()
  students: User[]; // Os Alunos desta turma

  @OneToMany(() => Problem, (problem) => problem.classroom)
  problems: Problem[];
}
