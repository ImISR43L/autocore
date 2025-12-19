import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { TestCase } from './test-case.entity';
import { Submission } from '../../submissions/entities/submission.entity';

export enum ProblemType {
  EXERCISE = 'EXERCISE',
  EXAM = 'EXAM',
}

@Entity()
export class Problem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  slug: string;

  // --- NOVOS CAMPOS ---
  @Column({
    type: 'enum',
    enum: ProblemType,
    default: ProblemType.EXERCISE,
  })
  type: ProblemType;

  @Column({ type: 'int', nullable: true, default: null })
  maxAttempts: number | null;
  // --------------------

  @ManyToOne(() => Classroom, (classroom) => classroom.problems, {
    onDelete: 'CASCADE',
  })
  classroom: Classroom;

  @OneToMany(() => TestCase, (testCase) => testCase.problem, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  testCases: TestCase[];

  @OneToMany(() => Submission, (submission) => submission.problem, {
    onDelete: 'CASCADE',
  })
  submissions: Submission[];

  @Column({ type: 'timestamp', nullable: true, default: null })
  deadline: Date | null;
}
