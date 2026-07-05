import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { ExamAccessToken } from './exam-access-token.entity';
import { User } from '../../users/entities/user.entity';

// Registra que um usuário específico resgatou um token de acesso
// específico. É esta tabela — não um claim dentro do JWT — que autoriza o
// acesso: não temos como emitir JWTs compatíveis com o Supabase (a
// validação é feita contra o JWKS remoto dele), então a fonte de verdade
// da autorização de escopo precisa viver no nosso próprio banco.
//
// `problemId` é desnormalizado a partir de `token.problem` de propósito:
// a checagem "esse usuário tem acesso a este problema?" roda em
// ProblemsService.findOne() e SubmissionsService.create() — caminhos
// já sensíveis a latência — e assim vira uma consulta direta por
// (user, problemId), sem precisar de join através de ExamAccessToken
// toda vez.
@Entity()
@Unique(['token', 'user'])
@Index(['user', 'problemId'])
export class ExamAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ExamAccessToken, (token) => token.grants, {
    onDelete: 'CASCADE',
  })
  token: ExamAccessToken;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column('uuid')
  problemId: string;

  @CreateDateColumn()
  createdAt: Date;
}
