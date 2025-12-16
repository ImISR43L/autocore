import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';

@Entity()
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  code: string;

  @Column()
  language_id: number;

  @Column({ nullable: true })
  status: string; // Accepted, Wrong Answer, etc.

  // Vincula a submissão a um problema específico
  @ManyToOne(() => Problem)
  problem: Problem;

  @CreateDateColumn()
  created_at: Date;
}
