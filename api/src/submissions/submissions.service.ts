import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Repository } from 'typeorm';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { SubjectType } from '../common/enums/subject-type.enum';
import { SubmissionsGateway } from './submissions.gateway';
import { ChemistryService } from '../chemistry/chemistry.service';
import { HtmlValidatorService } from '../html/html-validator.service';
import type { ValidationResult } from '../chemistry/chemistry.service';
interface LanguageConfig {
  fileName: string;
  runCommand: string[];
}
@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectQueue('submission-queue') private submissionsQueue: Queue,
    private submissionsGateway: SubmissionsGateway,
    private chemistryService: ChemistryService,
    private htmlValidatorService: HtmlValidatorService,
  ) {}

  async getProblemStats(problemId: string) {
    const submissions = await this.submissionsRepository.find({
      where: { problem: { id: problemId }, isDelivery: true },
      select: ['status'],
    });
    let accepted = 0;
    let error = 0;
    submissions.forEach((sub) => {
      if (sub.status === 'Accepted') accepted++;
      else error++;
    });
    return [
      { name: 'Acertos', value: accepted, fill: '#4caf50' },
      { name: 'Erros', value: error, fill: '#f44336' },
    ];
  }

  async getTeacherStats(userId: string) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { owner: { id: userId } } },
      select: ['id', 'title'],
    });
    const stats: { name: string; Accepted: number; Error: number }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id }, isDelivery: true },
        select: ['status'],
      });
      let acc = 0;
      let err = 0;
      subs.forEach((s) => {
        if (s.status === 'Accepted') acc++;
        else err++;
      });
      if (subs.length > 0) {
        stats.push({ name: p.title, Accepted: acc, Error: err });
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

  async create(createSubmissionDto: CreateSubmissionDto, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id: createSubmissionDto.problem_id },
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) {
      throw new NotFoundException('Problema não encontrado');
    }

    if (!problem.classroom?.owner) {
      throw new ForbiddenException(
        'O professor responsável por esta turma não existe mais. Não é possível enviar novas resoluções.',
      );
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

    // Validação de Linguagem Permitida
    const languageMap: Record<number, string> = {
      71: 'python',
      63: 'javascript',
      54: 'cpp',
    };

    // CORREÇÃO 1: Trata o undefined para o TS não reclamar do index type
    const submittedLangString =
      createSubmissionDto.language_id != null
        ? languageMap[createSubmissionDto.language_id]
        : undefined;

    if (
      problem.allowedLanguages &&
      problem.allowedLanguages.length > 0 &&
      submittedLangString &&
      !problem.allowedLanguages.includes(submittedLangString)
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

    // CORREÇÃO 2: Alterado de language_id para languageId para bater com a entidade
    const submission = this.submissionsRepository.create({
      files: createSubmissionDto.files,
      languageId: createSubmissionDto.language_id,
      problem,
      user: { id: userId },
      status: 'Pending',
      isDelivery: existingCount === 0,
      activityLogs: createSubmissionDto.activityLogs,
    });

    const savedSubmission = await this.submissionsRepository.save(submission);

    // Roteamento: HTML e Química são validações síncronas e baratas
    // (JSDOM / RDKit local) — não precisam da fila pesada do Go-Judge.
    // Resolvemos na própria requisição e nunca tocamos o BullMQ para elas.
    if (
      problem.subject === SubjectType.HTML ||
      problem.subject === SubjectType.CHEMISTRY
    ) {
      return this.resolveSynchronously(savedSubmission, problem, userId);
    }

    // Programação: segue o fluxo assíncrono via BullMQ + Go-Judge
    try {
      await this.submissionsQueue.add('grade', {
        submissionId: savedSubmission.id,
        files: savedSubmission.files,
        // CORREÇÃO 3: Lendo de languageId ao invés de language_id
        language: savedSubmission.languageId,
        testCases: problem.testCases,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
      });
    } catch (error) {
      savedSubmission.status = 'Internal Error';
      savedSubmission.output = 'Falha no sistema de filas.';
      await this.submissionsRepository.save(savedSubmission);
    }

    return savedSubmission;
  }

  /**
   * Resolve submissões síncronas (HTML/Química) sem passar pela fila do
   * Go-Judge. Salva o resultado final e dispara o WebSocket imediatamente,
   * tudo dentro da mesma requisição HTTP do envio.
   */
  private async resolveSynchronously(
    submission: Submission,
    problem: Problem,
    userId: string,
  ) {
    try {
      const files = submission.files;
      const firstFileContent =
        Array.isArray(files) && files.length > 0 ? files[0].content || '' : '';

      let result: ValidationResult;

      if (problem.subject === SubjectType.HTML) {
        const config = problem.validationConfig as any;
        if (!config?.rules?.length) {
          result = {
            status: 'Runtime Error',
            score: 0,
            feedback:
              'Configuração de validação ausente. Certifique-se de submeter ' +
              'para uma questão específica da prova, não para a prova em si.',
          };
        } else {
          result = this.htmlValidatorService.validateSubmission(
            firstFileContent,
            config,
          );
        }
      } else {
        const expectedSmiles = problem.validationConfig?.expectedSmiles || '';
        result = this.chemistryService.validateSubmission(
          firstFileContent,
          expectedSmiles,
        );
      }

      submission.status = result.status;
      submission.grade = result.score;
      submission.output = result.feedback ?? null;
      submission.executionTime = 0;
      submission.memoryUsage = 0;
    } catch (error) {
      this.logger.error('Erro na validação síncrona:', error);
      submission.status = 'Internal Error';
      submission.output = 'Erro interno ao processar a submissão.';
    }

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

    // NOVA VALIDAÇÃO: Bloqueio de turmas arquivadas
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
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    const isOwner = problem.classroom.owner?.id === userId;

    if (isOwner) {
      // O professor apenas vê as entregas oficiais (uma por aluno)
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
    const stats: { name: string; Accepted: number; Error: number }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id }, isDelivery: true },
        select: ['status'],
      });
      let acc = 0;
      let err = 0;
      subs.forEach((s) => {
        if (s.status === 'Accepted') acc++;
        else err++;
      });
      if (subs.length > 0) {
        stats.push({ name: p.title, Accepted: acc, Error: err });
      }
    }
    return stats;
  }
}
