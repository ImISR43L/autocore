import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { Submission } from '../../submissions/entities/submission.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ select: false })
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Turmas que sou dono (Professor)
  @OneToMany(() => Classroom, (classroom) => classroom.owner)
  ownedClassrooms: Classroom[];

  // Turmas que participo (Aluno)
  @ManyToMany(() => Classroom, (classroom) => classroom.students)
  joinedClassrooms: Classroom[];

  @OneToMany(() => Submission, (submission) => submission.user)
  submissions: Submission[];
}
