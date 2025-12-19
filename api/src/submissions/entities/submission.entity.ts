import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column()
  language_id: number;

  @Column()
  status: string;

  @Column({ type: 'text', nullable: true })
  stdout: string | null;

  @Column({ type: 'text', nullable: true })
  stderr: string | null;

  @CreateDateColumn()
  createdAt: Date;

  // --- AQUI ESTÁ A CORREÇÃO ---
  // Adicione { onDelete: 'CASCADE' } dentro do ManyToOne
  @ManyToOne(() => Problem, (problem) => problem.submissions, {
    onDelete: 'CASCADE',
  })
  problem: Problem;
  // ----------------------------

  @ManyToOne(() => User, (user) => user.submissions)
  user: User;
}
