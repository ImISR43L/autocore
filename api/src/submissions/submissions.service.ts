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
  ) {
    this.logger.log('[DEBUG] SubmissionsService inicializado.');
  }
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

  async getTeacherStats(userId: string) {
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

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: string) {
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

  async create(createSubmissionDto: CreateSubmissionDto, userId: string) {
    this.logger.log(
      `[DEBUG] Iniciando criação de submissão. UserID: ${userId}, ProblemID: ${createSubmissionDto.problem_id}`,
    );

    const problem = await this.problemsRepository.findOne({
      where: { id: createSubmissionDto.problem_id },
      relations: ['testCases'],
    });

    if (!problem) {
      this.logger.error('[DEBUG] Problema não encontrado.');
      throw new NotFoundException('Problema não encontrado');
    }

    // Validações de Prazo
    if (problem.startDate) {
      const now = new Date();
      if (now < problem.startDate) {
        throw new ForbiddenException('A atividade ainda não começou.');
      }
    }
    if (problem.deadline && new Date() > problem.deadline) {
      throw new ForbiddenException('O prazo de entrega já encerrou.');
    }

    // Criação da Entidade
    const submission = this.submissionsRepository.create({
      files: createSubmissionDto.files,
      language_id: createSubmissionDto.language_id,
      problem,
      user: { id: userId },
      status: 'Pending',
    });

    const savedSubmission = await this.submissionsRepository.save(submission);
    this.logger.log(
      `[DEBUG] Submissão salva no DB. ID: ${savedSubmission.id}. Status: Pending`,
    );

    // Envio para Fila
    try {
      this.logger.log(
        `[DEBUG] Tentando adicionar Job à fila 'submission-queue'...`,
      );

      const job = await this.submissionsQueue.add('grade', {
        submissionId: savedSubmission.id,
        files: savedSubmission.files,
        language: savedSubmission.language_id,
        testCases: problem.testCases,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
      });

      this.logger.log(
        `[DEBUG] SUCESSO: Job adicionado à fila. Job ID: ${job.id}`,
      );
    } catch (error) {
      this.logger.error(
        `[DEBUG] FALHA CRÍTICA ao adicionar Job na fila: ${error.message}`,
        error.stack,
      );
      // Opcional: Atualizar status para erro se falhar o envio para fila
      savedSubmission.status = 'Internal Error';
      savedSubmission.output = 'Falha no sistema de filas.';
      await this.submissionsRepository.save(savedSubmission);
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

  async getClassroomStats(classroomId: string, userId: string) {
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
