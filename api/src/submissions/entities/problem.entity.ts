import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { TestCase } from './test-case.entity';
import { User } from '../../users/entities/user.entity'; // Importe o User
import { Classroom } from '../../classrooms/entities/classroom.entity';

@Entity()
export class Problem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @OneToMany(() => TestCase, (testCase) => testCase.problem, {
    cascade: true, // Importante: Permite salvar testes junto com o problema
  })
  testCases: TestCase[];

  // Novo Relacionamento: Autor do Problema
  @ManyToOne(() => User, (user) => user.problems, { nullable: true })
  author: User;

  @ManyToOne(() => Classroom, (classroom) => classroom.problems, {
    onDelete: 'CASCADE',
  })
  classroom: Classroom;
}
