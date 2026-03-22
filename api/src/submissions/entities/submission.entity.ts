import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';
import { User } from '../../users/entities/user.entity';

export interface FileEntry {
  name: string;
  content: string;
}

@Entity()
@Index(['problem', 'user'])
@Index(['problem', 'status'])
@Index(['user', 'createdAt'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  files: FileEntry[];

  @Column()
  language_id: number;

  @Column()
  @Index()
  status: string;

  // NOVA COLUNA: Define se esta é a entrega oficial selecionada pelo aluno
  @Column({ type: 'boolean', default: false })
  @Index()
  isDelivery: boolean;

  @Column({ type: 'text', nullable: true })
  output: string | null;

  @Column({ type: 'int', nullable: true })
  executionTime: number | null;

  @Column({ type: 'int', nullable: true })
  memoryUsage: number | null;

  @Column({ type: 'text', nullable: true })
  stdout: string | null;

  @Column({ type: 'text', nullable: true })
  stderr: string | null;

  @Column({ type: 'float', nullable: true, default: null })
  grade: number | null;

  @Column({ type: 'text', nullable: true, default: null })
  teacherComment: string | null;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @ManyToOne(() => Problem, (problem) => problem.submissions, {
    onDelete: 'CASCADE',
  })
  problem: Problem;

  @ManyToOne(() => User, (user) => user.submissions, {
    onDelete: 'CASCADE',
  })
  user: User;
}
