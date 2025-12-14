import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  code: string;

  @Column()
  language_id: number;

  // COLUNA NOVA OBRIGATÓRIA
  @Column({ nullable: true, type: 'text' })
  stdin: string;

  @Column({ nullable: true, type: 'text' })
  stdout: string;

  @Column({ nullable: true, type: 'text' })
  stderr: string;

  @Column({ nullable: true })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
