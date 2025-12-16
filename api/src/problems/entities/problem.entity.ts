import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { TestCase } from './test-case.entity';
import { Classroom } from '../../classrooms/entities/classroom.entity';

@Entity()
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column()
  slug: string;

  // Relacionamento com Classroom (Muitos problemas pertencem a uma turma)
  @ManyToOne(() => Classroom, (classroom) => classroom.problems)
  classroom: Classroom;

  // Relacionamento com TestCases (Um problema tem muitos casos de teste)
  @OneToMany(() => TestCase, (testCase) => testCase.problem)
  testCases: TestCase[];
}
