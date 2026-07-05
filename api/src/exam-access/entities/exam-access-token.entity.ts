import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Problem } from '../../problems/entities/problem.entity';
import { User } from '../../users/entities/user.entity';
import { ExamAccessGrant } from './exam-access-grant.entity';

// Representa um link temporário criado pelo professor para uma prova
// específica. Guardamos o token em texto plano (não hasheado): ele não é
// uma senha reutilizável de uma conta, é um segredo de propósito único
// (equivalente a um link de convite/verificação de e-mail) — o risco
// residual de um vazamento do banco é mitigado por expiração curta e
// revogação manual, não por hashing.
@Entity()
export class ExamAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  token: string;

  @ManyToOne(() => Problem, { onDelete: 'CASCADE' })
  problem: Problem;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  // SET NULL (não CASCADE): se a conta do professor for excluída, o token
  // não deveria sumir/parar de funcionar por causa disso — só perdemos a
  // referência de quem criou.
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  createdBy: User | null;

  @OneToMany(() => ExamAccessGrant, (grant) => grant.token)
  grants: ExamAccessGrant[];

  @CreateDateColumn()
  createdAt: Date;
}
