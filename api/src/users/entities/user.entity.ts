import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  // Turmas que eu criei (sou Professor nestas)
  @OneToMany(() => Classroom, (classroom) => classroom.owner)
  ownedClassrooms: Classroom[];

  // Turmas que eu entrei (sou Aluno nestas)
  @ManyToMany(() => Classroom, (classroom) => classroom.students)
  joinedClassrooms: Classroom[];
}
