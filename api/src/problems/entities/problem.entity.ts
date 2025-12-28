import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { TestCase } from './test-case.entity';
import { Submission } from '../../submissions/entities/submission.entity';

export enum ProblemType {
  EXERCISE = 'EXERCISE',
  EXAM = 'EXAM',
}

// Interface para definir a assinatura (ex: nome: "nums", tipo: "int[]")
export interface ParameterDefinition {
  name: string;
  type: 'int' | 'float' | 'string' | 'boolean' | 'int[]' | 'string[]';
}

@Entity()
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

  // --- NOVO CAMPO: DEFINIÇÃO DOS PARÂMETROS ---
  @Column({ type: 'jsonb', default: [] }) // Use 'simple-json' se não estiver usando Postgres
  parameters: ParameterDefinition[];

  // Define o tipo de retorno (ex: 'int', 'boolean')
  @Column({ default: 'string' })
  returnType: string;
  // ---------------------------------------------

  @Column({ nullable: true })
  maxAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  deadline: Date;

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
}
