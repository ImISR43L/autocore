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

@Entity()
@Index(['problem', 'user']) // Busca histórico do aluno num problema específico
@Index(['problem', 'status']) // Busca estatísticas (Acertos vs Erros)
@Index(['user', 'createdAt']) // Busca "Minhas últimas submissões"
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column()
  language_id: number;

  @Column()
  @Index() // Índice simples para filtrar por status globalmente
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
  @Index() // Acelera ordenação por data
  createdAt: Date;

  @ManyToOne(() => Problem, (problem) => problem.submissions, {
    onDelete: 'CASCADE',
  })
  problem: Problem;

  @ManyToOne(() => User, (user) => user.submissions)
  user: User;
}
