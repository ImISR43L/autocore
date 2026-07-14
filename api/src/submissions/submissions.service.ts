import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { SubjectType } from '../common/enums/subject-type.enum';
import { SubmissionsGateway } from './submissions.gateway';
import { ExamAccessGrant } from '../exam-access/entities/exam-access-grant.entity';
import { LANGUAGE_CONFIG } from './language-config';
import {
  GradingResult,
  GradingStrategy,
} from './strategies/grading-strategy.interface';
import { ChemistryGradingStrategy } from './strategies/chemistry-grading.strategy';
import { HtmlGradingStrategy } from './strategies/html-grading.strategy';
import { ProgrammingGradingStrategy } from './strategies/programming-grading.strategy';
import { SqlQueryGradingStrategy } from './strategies/sql-query-grading.strategy';
import { ManualGradingStrategy } from './strategies/manual-grading.strategy';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  // Catálogo de estratégias, indexado pela matéria do problema. Adicionar
  // uma nova matéria (ex: Física) não exige tocar em nenhum método deste
  // service além do registro abaixo — só criar a nova GradingStrategy.
  private readonly gradingStrategies = new Map<SubjectType, GradingStrategy>();

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(ExamAccessGrant)
    private examAccessGrantsRepository: Repository<ExamAccessGrant>,
    private submissionsGateway: SubmissionsGateway,
    chemistryGradingStrategy: ChemistryGradingStrategy,
    htmlGradingStrategy: HtmlGradingStrategy,
    programmingGradingStrategy: ProgrammingGradingStrategy,
    sqlQueryGradingStrategy: SqlQueryGradingStrategy,
    manualGradingStrategy: ManualGradingStrategy,
  ) {
    this.gradingStrategies.set(SubjectType.CHEMISTRY, chemistryGradingStrategy);
    this.gradingStrategies.set(SubjectType.HTML, htmlGradingStrategy);
    this.gradingStrategies.set(
      SubjectType.PROGRAMMING,
      programmingGradingStrategy,
    );
    this.gradingStrategies.set(SubjectType.SQL, sqlQueryGradingStrategy);
    this.gradingStrategies.set(
      SubjectType.SQL_MODELING,
      manualGradingStrategy,
    );
  }

  // Pending (aguardando processamento assíncrono) e Awaiting Manual
  // Review (aguardando um professor) não são "erro" — sem essa checagem,
  // qualquer atividade de SQL_MODELING apareceria como 100% de erro nos
  // dashboards até alguém corrigir manualmente.
  private isNonTerminalStatus(status: string): boolean {
    return status === 'Pending' || status === 'Awaiting Manual Review';
  }

  async getProblemStats(problemId: string) {
    const submissions = await this.submissionsRepository.find({
      where: { problem: { id: problemId }, isDelivery: true },
      select: ['status'],
    });
    let accepted = 0;
    let error = 0;
    let awaiting = 0;
    submissions.forEach((sub) => {
      if (sub.status === 'Accepted') accepted++;
      else if (this.isNonTerminalStatus(sub.status)) awaiting++;
      else error++;
    });
    return [
      { name: 'Acertos', value: accepted, fill: '#4caf50' },
      { name: 'Erros', value: error, fill: '#f44336' },
      { name: 'Aguardando', value: awaiting, fill: '#f5a623' },
    ];
  }

  async getTeacherStats(userId: string) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { owner: { id: userId } } },
      select: ['id', 'title'],
    });
    const stats: {
      name: string;
      Accepted: number;
      Error: number;
      Awaiting: number;
    }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id }, isDelivery: true },
        select: ['status'],
      });
      let acc = 0;
      let err = 0;
      let awt = 0;
      subs.forEach((s) => {
        if (s.status === 'Accepted') acc++;
        else if (this.isNonTerminalStatus(s.status)) awt++;
        else err++;
      });
      if (subs.length > 0) {
        stats.push({ name: p.title, Accepted: acc, Error: err, Awaiting: awt });
      }
    }
    return stats;
  }

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: string) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });
    if (!submission) throw new NotFoundException('Submissão não encontrada');

    if (submission.problem?.classroom?.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }
    if (submission.problem?.classroom?.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o professor pode avaliar.');
    }
    submission.grade = gradeDto.grade ?? null;
    submission.teacherComment = gradeDto.teacherComment ?? null;
    return this.submissionsRepository.save(submission);
  }

  /**
   * Verifica grant tanto pelo id do problema em si quanto pelo id do seu
   * PAI (se houver). Necessário porque o token de acesso é gerado e
   * concedido para a prova (o problema pai), mas as submissões de código
   * são feitas contra cada QUESTÃO (problema filho) individualmente — sem
   * checar o pai, um convidado com grant válido era barrado ao tentar
   * testar/entregar qualquer questão da prova.
   */
  private async hasActiveExamGrant(
    userId: string,
    problem: Problem,
  ): Promise<boolean> {
    const candidateIds = [problem.id];
    if (problem.parent?.id) candidateIds.push(problem.parent.id);

    const count = await this.examAccessGrantsRepository.count({
      where: {
        user: { id: userId },
        problemId: In(candidateIds),
        token: { revoked: false, expiresAt: MoreThan(new Date()) },
      },
    });
    return count > 0;
  }

  async create(createSubmissionDto: CreateSubmissionDto, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id: createSubmissionDto.problem_id },
      relations: [
        'testCases',
        'classroom',
        'classroom.owner',
        'classroom.students',
        'parent',
      ],
    });

    if (!problem) {
      throw new NotFoundException('Problema não encontrado');
    }

    if (!problem.classroom?.owner) {
      throw new ForbiddenException(
        'O professor responsável por esta turma não existe mais. Não é possível enviar novas resoluções.',
      );
    }

    // CORREÇÃO DE SEGURANÇA: antes disto, qualquer usuário autenticado da
    // plataforma conseguia enviar submissões para qualquer problema de
    // qualquer turma, bastando saber o UUID — nunca havia checagem de
    // matrícula aqui, só validações de prazo/idioma/tentativas.
    const isOwner = String(problem.classroom.owner.id) === String(userId);
    const isEnrolled = problem.classroom.students?.some(
      (student) => String(student.id) === String(userId),
    );
    const hasGrant =
      !isOwner &&
      !isEnrolled &&
      (await this.hasActiveExamGrant(userId, problem));

    if (!isOwner && !isEnrolled && !hasGrant) {
      throw new ForbiddenException('Você não está matriculado nesta turma.');
    }

    if (problem.classroom?.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Não é possível enviar resoluções.',
      );
    }

    // Validações de Prazo e Acesso
    if (problem.startDate) {
      const now = new Date();
      if (now < problem.startDate) {
        throw new ForbiddenException('A atividade ainda não começou.');
      }
    }

    if (problem.deadline && new Date() > problem.deadline) {
      throw new ForbiddenException('O prazo de entrega já encerrou.');
    }

    // FIX (a): antes havia um `languageMap` local aqui, que só conhecia
    // Python/JS/C++, divergente do mapa usado no Processor (que também
    // roda Java/Go/C). Um aluno podia submeter nessas linguagens sem
    // jamais passar pela checagem de `allowedLanguages` da questão, porque
    // este mapa simplesmente não sabia que esses IDs existiam. Agora os
    // dois lugares importam a mesma constante.
    const langConfig =
      createSubmissionDto.language_id != null
        ? LANGUAGE_CONFIG[createSubmissionDto.language_id]
        : undefined;

    if (
      problem.allowedLanguages &&
      problem.allowedLanguages.length > 0 &&
      langConfig &&
      !problem.allowedLanguages.includes(langConfig.slug)
    ) {
      throw new ForbiddenException(
        'A linguagem selecionada não é permitida para esta atividade.',
      );
    }

    const existingCount = await this.submissionsRepository.count({
      where: { problem: { id: problem.id }, user: { id: userId } },
    });

    if (problem.maxAttempts && problem.maxAttempts > 0) {
      if (existingCount >= problem.maxAttempts) {
        throw new ForbiddenException(
          `Limite de envios excedido. O máximo permitido para esta atividade é de ${problem.maxAttempts} tentativa(s).`,
        );
      }
    }

    const submission = this.submissionsRepository.create({
      files: createSubmissionDto.files,
      modelData: createSubmissionDto.modelData as any,
      languageId: createSubmissionDto.language_id,
      problem,
      user: { id: userId },
      status: 'Pending',
      isDelivery: existingCount === 0,
      activityLogs: createSubmissionDto.activityLogs,
    });

    const savedSubmission = await this.submissionsRepository.save(submission);

    return this.routeToGradingStrategy(savedSubmission, problem, userId);
  }

  /**
   * Ponto único de despacho para o Strategy Pattern. Substitui os dois
   * `if/else` que existiam antes (um decidindo sync-vs-fila, outro
   * decidindo HTML-vs-Química) por uma única resolução via Map.
   *
   * Também resolve parcialmente o bug (c) do processor: qualquer exceção
   * lançada pela própria estratégia (ex: falha ao enfileirar no Bull) é
   * capturada aqui e a submissão é marcada como 'Internal Error' — em vez
   * de o aluno ficar com uma submissão presa em 'Pending' sem explicação.
   */
  private async routeToGradingStrategy(
    submission: Submission,
    problem: Problem,
    userId: string,
  ) {
    const strategy = this.gradingStrategies.get(problem.subject);

    if (!strategy) {
      submission.status = 'Internal Error';
      submission.output =
        'Motor de correção não configurado para este tipo de exercício.';
      return this.submissionsRepository.save(submission);
    }

    try {
      const result = await strategy.grade(submission, problem);

      // Modo síncrono (HTML/Química): o resultado já é final, persistimos
      // e notificamos o aluno imediatamente, dentro da mesma requisição.
      if (strategy.mode === 'sync') {
        return this.persistAndNotify(submission, result, userId);
      }

      // Modo assíncrono (Programação, SQL): a estratégia já enfileirou o
      // job; quem persiste o resultado final e notifica é o Processor
      // correspondente.
      return submission;
    } catch (error) {
      this.logger.error(
        `Erro ao rotear submissão ${submission.id} para a estratégia de correção:`,
        error,
      );
      submission.status = 'Internal Error';
      submission.output = 'Falha no sistema de correção.';
      return this.submissionsRepository.save(submission);
    }
  }

  private async persistAndNotify(
    submission: Submission,
    result: GradingResult,
    userId: string,
  ) {
    submission.status = result.status;
    // 'Awaiting Manual Review' não é um resultado final — gravar grade=0
    // aqui pareceria "já corrigido e zerado" tanto pro aluno quanto nos
    // dashboards. Deixa null até o professor de fato avaliar via
    // SubmissionsService.grade().
    submission.grade =
      result.status === 'Awaiting Manual Review' ? null : result.score;
    submission.output = result.feedback ?? null;
    submission.executionTime = 0;
    submission.memoryUsage = 0;

    const savedSubmission = await this.submissionsRepository.save(submission);

    this.submissionsGateway.server
      .to(`user-${userId}`)
      .emit('submission-finished', savedSubmission);

    return savedSubmission;
  }

  async findOne(id: string, requestingUserId: string) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: [
        'problem',
        'problem.classroom',
        'problem.classroom.owner',
        'user',
      ],
    });
    if (!submission) throw new NotFoundException('Submissão não encontrada');

    const isOwner =
      submission.problem?.classroom?.owner?.id === requestingUserId;
    const isAuthor = submission.user?.id === requestingUserId;

    // CORREÇÃO DE SEGURANÇA: antes disto, qualquer usuário autenticado
    // (não só o professor da turma ou o próprio autor) conseguia ver o
    // conteúdo completo de QUALQUER submissão — código, output, nota,
    // comentário do professor — bastando saber o UUID. A checagem só
    // controlava se `activityLogs` era removido, nunca se a pessoa tinha
    // o direito de ver a submissão como um todo.
    if (!isOwner && !isAuthor) {
      throw new ForbiddenException('Você não tem acesso a esta submissão.');
    }

    if (!isOwner) {
      const { activityLogs, ...rest } = submission;
      return rest;
    }
    return submission;
  }

  async markAsDelivery(id: string, userId: string) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: [
        'problem',
        'problem.classroom',
        'problem.classroom.owner',
        'user',
      ],
    });

    if (!submission) throw new NotFoundException('Submissão não encontrada');
    if (submission.user.id !== userId)
      throw new ForbiddenException('Ação não permitida.');

    if (!submission.problem?.classroom?.owner) {
      throw new ForbiddenException(
        'O professor responsável por esta turma não existe mais. Ações bloqueadas.',
      );
    }

    if (submission.problem?.classroom?.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    if (
      submission.problem.deadline &&
      new Date() > submission.problem.deadline
    ) {
      throw new ForbiddenException(
        'O prazo encerrou. Não é possível alterar a entrega oficial.',
      );
    }

    await this.submissionsRepository.update(
      {
        problem: { id: submission.problem.id },
        user: { id: userId },
        isDelivery: true,
      },
      { isDelivery: false },
    );

    submission.isDelivery = true;
    return this.submissionsRepository.save(submission);
  }

  async findAllByProblem(problemId: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id: problemId },
      relations: [
        'classroom',
        'classroom.owner',
        'classroom.students',
        'parent',
      ],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    const isOwner = problem.classroom.owner?.id === userId;
    const isEnrolled = problem.classroom.students?.some(
      (student) => String(student.id) === String(userId),
    );
    const hasGrant =
      !isOwner &&
      !isEnrolled &&
      (await this.hasActiveExamGrant(userId, problem));

    if (!isOwner && !isEnrolled && !hasGrant) {
      throw new ForbiddenException('Você não está matriculado nesta turma.');
    }

    if (isOwner) {
      return this.submissionsRepository.find({
        where: { problem: { id: problemId }, isDelivery: true },
        relations: ['user', 'problem'],
        order: { createdAt: 'DESC' },
      });
    } else {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: problemId }, user: { id: userId } },
        relations: ['user', 'problem'],
        order: { createdAt: 'DESC' },
      });
      return subs.map(({ activityLogs, ...rest }) => rest);
    }
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async getClassroomStats(classroomId: string, userId: string) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { id: classroomId } },
      select: ['id', 'title'],
    });
    const stats: {
      name: string;
      Accepted: number;
      Error: number;
      Awaiting: number;
    }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id }, isDelivery: true },
        select: ['status'],
      });
      let acc = 0;
      let err = 0;
      let awt = 0;
      subs.forEach((s) => {
        if (s.status === 'Accepted') acc++;
        else if (this.isNonTerminalStatus(s.status)) awt++;
        else err++;
      });
      if (subs.length > 0) {
        stats.push({ name: p.title, Accepted: acc, Error: err, Awaiting: awt });
      }
    }
    return stats;
  }
}
