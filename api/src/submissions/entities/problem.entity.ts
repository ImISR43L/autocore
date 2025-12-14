import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { TestCase } from './test-case.entity';

@Entity()
export class Problem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  description: string;

  // Um problema tem vários casos de teste
  @OneToMany(() => TestCase, (testCase) => testCase.problem)
  testCases: TestCase[];
}
