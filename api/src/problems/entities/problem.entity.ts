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

@Entity()
export class Problem {
  @PrimaryGeneratedColumn('uuid') // Ou 'increment', mantenha o que você já usa
  id: string; // Se mudou para string/uuid, mantenha string. Se for number, number.

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  slug: string;

  @ManyToOne(() => Classroom, (classroom) => classroom.problems, {
    onDelete: 'CASCADE', // Se apagar a turma, apaga o problema
  })
  classroom: Classroom;

  @OneToMany(() => TestCase, (testCase) => testCase.problem, {
    cascade: true, // Permite salvar/editar testCases junto com o problema
    onDelete: 'CASCADE', // <--- CORREÇÃO: Se apagar problema, apaga os testes
  })
  testCases: TestCase[];

  // Adicione a relação com Submissions se ainda não tiver, para garantir o Cascade
  @OneToMany(() => Submission, (submission) => submission.problem, {
    onDelete: 'CASCADE', // <--- CORREÇÃO: Se apagar problema, apaga as submissões
  })
  submissions: Submission[];
}
