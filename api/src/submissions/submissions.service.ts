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
import { Problem, ProblemType } from '../problems/entities/problem.entity';
// Removido: import { WrapperGenerator } ...

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
  ) {}

  // ... (getProblemStats, getTeacherStats, grade mantidos iguais) ...
  async getProblemStats(problemId: string) {
    const submissions = await this.submissionsRepository.find({
      where: { problem: { id: problemId } },
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

  async getTeacherStats(userId: number) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { owner: { id: userId } } },
      select: ['id', 'title'],
    });
    const stats: { name: string; Accepted: number; Error: number }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id } },
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

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });
    if (!submission) throw new NotFoundException('Submissão não encontrada');
    if (submission.problem?.classroom?.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o professor pode avaliar.');
    }
    submission.grade = gradeDto.grade ?? null;
    submission.teacherComment = gradeDto.teacherComment ?? null;
    return this.submissionsRepository.save(submission);
  }

  // --- ALTERAÇÃO NO CREATE: REMOVIDA APLICAÇÃO DO WRAPPER ---
  async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    const { files, language_id, problem_id } = createSubmissionDto;

    const problem = await this.problemsRepository.findOne({
      where: { id: String(problem_id) },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.classroom && problem.classroom.owner.id === userId) {
      throw new ForbiddenException(
        'Professores não podem realizar submissões.',
      );
    }

    if (problem.type === ProblemType.EXAM) {
      const now = new Date();
      if (
        problem.startedAt &&
        problem.timeLimit &&
        now.getTime() - problem.startedAt.getTime() >
          problem.timeLimit * 60 * 1000
      ) {
        throw new ForbiddenException('Tempo de prova esgotado.');
      }
      if (problem.maxAttempts) {
        const count = await this.submissionsRepository.count({
          where: { problem: { id: String(problem.id) }, user: { id: userId } },
        });
        if (count >= problem.maxAttempts) {
          throw new ForbiddenException('Limite de tentativas excedido.');
        }
      }
    }
    if (problem.deadline && new Date() > problem.deadline) {
      if (problem.classroom.owner.id !== userId) {
        throw new ForbiddenException('O prazo de entrega já encerrou.');
      }
    }

    // CRIAÇÃO COM ARQUIVOS ORIGINAIS (SEM WRAPPER)
    const submission = this.submissionsRepository.create({
      files,
      language_id: Number(language_id),
      status: 'Queued',
      stdout: '',
      stderr: '',
      problem,
      user: { id: userId },
    });

    const savedSubmission = await this.submissionsRepository.save(submission);

    this.logger.log(
      `Submissão ${savedSubmission.id} criada. Enviando para fila Redis...`,
    );

    try {
      await this.submissionsQueue.add('execute-code', {
        submissionId: savedSubmission.id,
      });
      this.logger.log(
        `Submissão ${savedSubmission.id} enviada para fila com sucesso.`,
      );
    } catch (error) {
      this.logger.error(
        `FALHA ao enviar submissão ${savedSubmission.id} para fila: ${error.message}`,
      );
    }

    return savedSubmission;
  }

  async findOne(id: string) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'user'],
    });
    if (!submission) throw new NotFoundException('Submissão não encontrada');
    return submission;
  }

  async findAllByProblem(problemId: string) {
    return this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      relations: ['user', 'problem'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async getClassroomStats(classroomId: number, userId: number) {
    const problems = await this.problemsRepository.find({
      where: { classroom: { id: classroomId } },
      select: ['id', 'title'],
    });
    const stats: { name: string; Accepted: number; Error: number }[] = [];
    for (const p of problems) {
      const subs = await this.submissionsRepository.find({
        where: { problem: { id: p.id } },
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
