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

  // ESTES CAMPOS SÃO OBRIGATÓRIOS PARA CORRIGIR O ERRO DA LINHA 100
  @Column({ type: 'text', nullable: true })
  stdout: string | null; // <--- Adicione "| null" aqui

  @Column({ type: 'text', nullable: true })
  stderr: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Problem, (problem) => problem.submissions)
  problem: Problem;

  @ManyToOne(() => User, (user) => user.submissions)
  user: User;
}
