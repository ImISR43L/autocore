import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { TestCase } from './test-case.entity';
import { Submission } from '../../submissions/entities/submission.entity';

export enum ProblemType {
  EXERCISE = 'EXERCISE',
  EXAM = 'EXAM',
}

export interface ParameterDefinition {
  name: string;
  type: 'int' | 'float' | 'string' | 'boolean' | 'int[]' | 'string[]';
}

export interface FileEntry {
  name: string;
  content: string;
}

@Entity()
@Index(['classroom'])
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: ProblemType,
    default: ProblemType.EXERCISE,
  })
  type: ProblemType;

  @Column({ type: 'jsonb', default: [] })
  parameters: ParameterDefinition[];

  // NOVO: Template inicial para o aluno (Múltiplos Arquivos)
  // Ex: [{ name: "main.c", content: "..." }, { name: "header.h", content: "..." }]
  @Column({ type: 'jsonb', nullable: true })
  starterCode: FileEntry[] | null;

  @Column({ default: 'string' })
  returnType: string;

  @Column({ nullable: true })
  maxAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ type: 'int', nullable: true })
  timeLimit: number;

  @Column({ type: 'int', nullable: true })
  memoryLimit: number; // Megabytes (MB)

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Classroom, (classroom) => classroom.problems, {
    onDelete: 'CASCADE',
  })
  classroom: Classroom;

  @OneToMany(() => TestCase, (testCase) => testCase.problem, { cascade: true })
  testCases: TestCase[];

  @OneToMany(() => Submission, (submission) => submission.problem)
  submissions: Submission[];

  @ManyToOne(() => Problem, (problem) => problem.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  parent: Problem;

  @OneToMany(() => Problem, (problem) => problem.parent, { cascade: true })
  children: Problem[];

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;
}
