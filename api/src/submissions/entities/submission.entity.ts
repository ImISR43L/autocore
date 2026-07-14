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

export interface ActivityLog {
  action: 'COPY' | 'PASTE' | 'BLUR' | 'FOCUS';
  timestamp: string;
  details?: string;
}

// Estrutura do diagrama ER submetido pelo aluno (Fase 2 — modelagem
// conceitual). Ver ErModel no frontend para o tipo espelhado usado pelo
// editor de diagrama.
export interface ErModelAttribute {
  name: string;
  isPK: boolean;
  isFK: boolean;
  type?: string;
}

export interface ErModelEntity {
  id: string;
  name: string;
  attributes: ErModelAttribute[];
  position?: { x: number; y: number };
}

export interface ErModelRelationship {
  id: string;
  from: string;
  to: string;
  cardinality: '1:1' | '1:N' | 'N:M';
  name?: string;
}

export interface ErModel {
  entities: ErModelEntity[];
  relationships: ErModelRelationship[];
}

@Entity()
@Index(['problem', 'user'])
@Index(['problem', 'status'])
@Index(['user', 'createdAt'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable a partir da Fase 2: submissões de modelagem (SQL_MODELING)
  // não têm arquivos de texto, usam `modelData` abaixo. Continua
  // obrigatório na prática para as demais matérias — a obrigatoriedade
  // é aplicada em CreateSubmissionDto por subject, não aqui na entidade.
  @Column({ type: 'jsonb', nullable: true })
  files: FileEntry[] | null;

  @Column({ type: 'int', nullable: true })
  languageId: number;

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

  // NOVA COLUNA (Fase 2): o diagrama ER desenhado pelo aluno, serializado
  // como ErModel. Coluna própria em vez de reaproveitar `files` (que
  // guardaria um JSON.stringify(ErModel) dentro de um FileEntry) — não é
  // um "arquivo" semanticamente, é uma estrutura de grafo, e uma coluna
  // dedicada permite consultar/validar sem parsear JSON dentro de JSON.
  @Column({ type: 'jsonb', nullable: true })
  modelData: ErModel | null;

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

  @Column({
    type: 'jsonb',
    nullable: true,
    default: [],
  })
  activityLogs: ActivityLog[];
}
