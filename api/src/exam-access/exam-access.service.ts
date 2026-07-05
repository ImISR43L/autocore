import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ExamAccessToken } from './entities/exam-access-token.entity';
import { ExamAccessGrant } from './entities/exam-access-grant.entity';
import { Problem, ProblemType } from '../problems/entities/problem.entity';
import { UsersService } from '../users/users.service';
import { CreateExamAccessTokenDto } from './dto/create-exam-access-token.dto';
import { RedeemExamAccessDto } from './dto/redeem-exam-access.dto';

const DEFAULT_EXPIRATION_HOURS = 24;

// Mensagem única para "não existe", "expirou" e "foi revogado". De propósito:
// diferenciar essas respostas ajudaria alguém tentando enumerar ou forçar
// tokens válidos a distinguir "quase certo" de "totalmente errado".
const INVALID_TOKEN_MESSAGE = 'Link inválido ou expirado.';

@Injectable()
export class ExamAccessService {
  constructor(
    @InjectRepository(ExamAccessToken)
    private tokensRepository: Repository<ExamAccessToken>,
    @InjectRepository(ExamAccessGrant)
    private grantsRepository: Repository<ExamAccessGrant>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private usersService: UsersService,
  ) {}

  async generate(
    problemId: string,
    teacherId: string,
    dto: CreateExamAccessTokenDto,
  ) {
    const problem = await this.problemsRepository.findOne({
      where: { id: problemId },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Prova não encontrada.');
    if (problem.classroom?.owner?.id !== teacherId) {
      throw new ForbiddenException(
        'Apenas o professor da turma pode gerar links de acesso.',
      );
    }
    if (problem.type !== ProblemType.EXAM) {
      throw new ForbiddenException(
        'Links de acesso temporário só podem ser gerados para provas.',
      );
    }

    const hours = dto.expiresInHours ?? DEFAULT_EXPIRATION_HOURS;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const token = this.tokensRepository.create({
      // 32 bytes de entropia, codificados em hex (64 caracteres) — não é
      // adivinhável por força bruta em nenhum prazo prático.
      token: randomBytes(32).toString('hex'),
      problem,
      expiresAt,
      createdBy: { id: teacherId } as any,
    });

    return this.tokensRepository.save(token);
  }

  async listForProblem(problemId: string, teacherId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id: problemId },
      relations: ['classroom', 'classroom.owner'],
    });
    if (!problem) throw new NotFoundException('Prova não encontrada.');
    if (problem.classroom?.owner?.id !== teacherId) {
      throw new ForbiddenException('Ação não permitida.');
    }

    return this.tokensRepository.find({
      where: { problem: { id: problemId } },
      order: { createdAt: 'DESC' },
    });
  }

  async revoke(tokenId: string, teacherId: string) {
    const token = await this.tokensRepository.findOne({
      where: { id: tokenId },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });
    if (!token) throw new NotFoundException('Token não encontrado.');
    if (token.problem.classroom?.owner?.id !== teacherId) {
      throw new ForbiddenException('Ação não permitida.');
    }

    token.revoked = true;
    return this.tokensRepository.save(token);
  }

  /** Validação pública (sem guard), usada para renderizar a tela de convite
   * antes de qualquer autenticação. Retorna só o mínimo necessário — nunca
   * o enunciado, código, ou qualquer dado sensível da prova. */
  async getPublicInfo(rawToken: string) {
    const token = await this.findValidToken(rawToken);

    return {
      problemTitle: token.problem.title,
      teacherName: token.problem.classroom?.owner?.name ?? null,
      expiresAt: token.expiresAt,
    };
  }

  async redeem(
    rawToken: string,
    supabaseUserId: string,
    dto: RedeemExamAccessDto,
  ) {
    const token = await this.findValidToken(rawToken);

    if (token.problem.classroom?.isArchived) {
      throw new ForbiddenException(
        'Esta turma está arquivada e não aceita mais acessos.',
      );
    }

    const user = await this.usersService.findOrCreateGuest(
      supabaseUserId,
      dto.name,
      dto.email ?? '',
    );

    // Idempotente: reabrir o mesmo link (F5, outra aba, etc.) não deve
    // duplicar o grant nem estourar a constraint única (token, user).
    let grant = await this.grantsRepository.findOne({
      where: { token: { id: token.id }, user: { id: user.id } },
    });

    if (!grant) {
      grant = this.grantsRepository.create({
        token,
        user,
        problemId: token.problem.id,
      });
      await this.grantsRepository.save(grant);
    }

    return {
      problemId: token.problem.id,
      classroomId: token.problem.classroom?.id ?? null,
    };
  }

  private async findValidToken(rawToken: string): Promise<ExamAccessToken> {
    const token = await this.tokensRepository.findOne({
      where: { token: rawToken },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!token || token.revoked || token.expiresAt < new Date()) {
      throw new NotFoundException(INVALID_TOKEN_MESSAGE);
    }

    return token;
  }
}
