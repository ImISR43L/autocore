import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
  Unique,
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
  type:
    | 'int'
    | 'float'
    | 'string'
    | 'boolean'
    | 'int[]'
    | 'string[]'
    | 'float[]'
    | 'boolean[]';
}

export interface StarterCodeDefinition {
  languageId: number;
  code: string;
  name?: string;
  content?: string;
}

@Entity()
@Index(['classroom'])
@Unique(['slug', 'classroom'])
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  slug: string;

  @Column({
    type: 'enum',
    enum: ['EASY', 'MEDIUM', 'HARD'],
    default: 'EASY',
  })
  difficulty: string;

  @Column({ type: 'text', nullable: true })
  teacherNotes: string;

  @Column('simple-array', { nullable: true })
  allowedLanguages: string[];

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({
    type: 'enum',
    enum: ProblemType,
    default: ProblemType.EXERCISE,
  })
  type: ProblemType;

  @Column({ type: 'jsonb', default: [] })
  parameters: ParameterDefinition[];

  @Column({ type: 'jsonb', nullable: true })
  starterCode: StarterCodeDefinition[] | null;

  @Column({ type: 'jsonb', default: [], select: false }) // select: false protege de retornar para o aluno num findAll comum
  solutionCode: { name: string; content: string }[];

  @Column({ default: 'string' })
  returnType: string;

  @Column({ nullable: true })
  maxAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

  @Column({ type: 'int', nullable: true })
  timeLimit: number;

  @Column({ type: 'int', nullable: true })
  memoryLimit: number;

  // REINSERIDO: Data de início (Agendamento da Prova)
  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

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

  // REINSERIDO: Auto-relacionamento para Sub-questões
  @ManyToOne(() => Problem, (problem) => problem.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  parent: Problem;

  @OneToMany(() => Problem, (problem) => problem.parent, { cascade: true })
  children: Problem[];
}
