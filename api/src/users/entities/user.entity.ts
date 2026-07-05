import {
  Entity,
  Column,
  PrimaryColumn,
  OneToMany,
  ManyToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Submission } from '../../submissions/entities/submission.entity';

@Entity()
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  // Um usuário criado via token de acesso temporário de prova (sem conta
  // real na plataforma). `email` continua único e obrigatório, mas para
  // convidados ele recebe um valor sintético (sessões anônimas do
  // Supabase não têm e-mail) — o e-mail de verdade informado no resgate
  // fica em `guestEmail`, só pra referência/contato do professor.
  @Column({ default: false })
  isGuest: boolean;

  @Column({ nullable: true })
  guestEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Classroom, (classroom) => classroom.owner)
  ownedClassrooms: Classroom[];

  @ManyToMany(() => Classroom, (classroom) => classroom.students)
  joinedClassrooms: Classroom[];

  @OneToMany(() => Submission, (submission) => submission.user)
  submissions: Submission[];
}
