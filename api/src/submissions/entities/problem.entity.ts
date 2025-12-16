import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { TestCase } from './test-case.entity';
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
    cascade: true,
  })
  testCases: TestCase[];

  // CORREÇÃO: Aponta para Classroom, e NÃO para User
  @ManyToOne(() => Classroom, (classroom) => classroom.problems, {
    onDelete: 'CASCADE',
  })
  classroom: Classroom;
}
