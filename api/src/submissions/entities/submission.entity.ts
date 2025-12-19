import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Problem } from '../../problems/entities/problem.entity';

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

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, (user) => user.submissions, { eager: true })
  user: User;

  @ManyToOne(() => Problem, (problem) => problem.submissions, {
    onDelete: 'CASCADE',
  })
  problem: Problem;
}
