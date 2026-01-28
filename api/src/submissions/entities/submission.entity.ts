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

// Interface auxiliar para tipagem
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

  // ALTERAÇÃO: De 'code: string' para 'files: jsonb'
  // Armazena: [{ name: "main.py", content: "..." }, { name: "utils.py", content: "..." }]
  @Column({ type: 'jsonb' })
  files: FileEntry[];

  @Column()
  language_id: number;

  @Column()
  @Index()
  status: string;

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

  @ManyToOne(() => User, (user) => user.submissions)
  user: User;
}
