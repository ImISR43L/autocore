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
import { Problem } from '../../problems/entities/problem.entity';

@Entity()
export class Classroom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @ManyToOne(() => User, (user) => user.ownedClassrooms)
  owner: User;

  @ManyToMany(() => User, (user) => user.joinedClassrooms)
  @JoinTable()
  students: User[];

  @OneToMany(() => Problem, (problem) => problem.classroom)
  problems: Problem[];
}
