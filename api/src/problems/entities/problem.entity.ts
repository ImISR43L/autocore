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
import { SubjectType } from '../../common/enums/subject-type.enum';

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
    enum: SubjectType,
    default: SubjectType.PROGRAMMING,
  })
  subject: SubjectType;

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

  @Column({ type: 'jsonb', default: [] })
  solutionCode: { name: string; content: string }[];

  @Column({ type: 'jsonb', nullable: true })
  validationConfig: Record<string, any>;

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

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  /**
   * DDL de referência para exercícios de SQL (CREATE TABLE, PKs, FKs,
   * constraints). É executado em um schema efêmero, isolado por
   * submissão, antes da query do aluno rodar — ver SqlExecutorService.
   *
   * Fica em coluna própria (não dentro de `validationConfig`) pelo mesmo
   * motivo de `timeLimit`/`memoryLimit` serem colunas dedicadas: é um
   * dado estrutural do exercício, não uma opção de validação, e precisa
   * ser lido sem parsear um jsonb genérico toda vez.
   */
  @Column({ type: 'text', nullable: true })
  sqlSchema: string | null;

  /**
   * Se true, a comparação do result set respeita a ordem das linhas
   * retornadas pela query do aluno (exercício exige ORDER BY explícito).
   * Se false (default), duas queries que retornam o mesmo conjunto de
   * linhas em ordens diferentes são consideradas equivalentes.
   */
  @Column({ type: 'boolean', default: false })
  sqlOrderSensitive: boolean;

  // Gabarito de modelagem conceitual (Fase 2 — subject SQL_MODELING).
  // Mesma estrutura ErModel que Submission.modelData (ver
  // submission.entity.ts). Nullable porque a Fase 2a (visualizador +
  // correção manual) funciona sem gabarito formal — o professor pode
  // avaliar de olho. Preencher isto passa a valer a pena quando existir
  // um corretor automático (Fase 2b) para comparar contra.
  @Column({ type: 'jsonb', nullable: true })
  referenceModel: Record<string, any> | null;

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
}
