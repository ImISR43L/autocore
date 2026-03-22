import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Classroom } from '../../classrooms/entities/classroom.entity';

@Entity()
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, {
    eager: true,
    onDelete: 'CASCADE',
  })
  author: User;

  @ManyToOne(() => Classroom, (classroom) => classroom.announcements, {
    onDelete: 'CASCADE', // Se apagar a turma, apaga os avisos
  })
  classroom: Classroom;

  @Column({ type: 'jsonb', nullable: true, default: [] })
  attachments: any[];

  @Column({ type: 'jsonb', nullable: true, default: [] })
  links: any[];
}
