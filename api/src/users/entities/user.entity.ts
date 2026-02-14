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
