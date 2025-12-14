import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Problem } from './problem.entity';

@Entity()
export class TestCase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  input: string; // O que o Judge0 vai injetar no stdin

  @Column('text')
  expected_output: string; // O que o programa DEVE retornar

  @ManyToOne(() => Problem, (problem) => problem.testCases)
  problem: Problem;
}
