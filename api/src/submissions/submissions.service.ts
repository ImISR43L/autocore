import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto'; // <--- Importe
import { Submission } from './entities/submission.entity';
import { Problem, ProblemType } from '../problems/entities/problem.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
  ) {}

  async getProblemStats(problemId: string) {
    const submissions = await this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      select: ['status'], // Otimização: traz apenas o status
    });

    let accepted = 0;
    let error = 0;

    submissions.forEach((sub) => {
      if (sub.status === 'Accepted') {
        accepted++;
      } else {
        error++;
      }
    });

    return [
      { name: 'Acertos', value: accepted, fill: '#4caf50' }, // Verde
      { name: 'Erros', value: error, fill: '#f44336' }, // Vermelho
    ];
  }

  // --- NOVO MÉTODO GRADE ---
  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!submission) {
      throw new NotFoundException('Submissão não encontrada');
    }

    // Verifica se quem está dando a nota é o professor da turma
    if (submission.problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o professor desta turma pode avaliar.',
      );
    }

    if (gradeDto.grade !== undefined) submission.grade = gradeDto.grade;
    if (gradeDto.teacherComment !== undefined)
      submission.teacherComment = gradeDto.teacherComment;

    return this.submissionsRepository.save(submission);
  }
  // ------------------------

  async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    const { code, language_id, problem_id } = createSubmissionDto;

    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    if (problem.type === ProblemType.EXAM && problem.maxAttempts) {
      const attempts = await this.submissionsRepository.count({
        where: {
          problem: { id: problem.id },
          user: { id: userId },
        },
      });

      if (attempts >= problem.maxAttempts) {
        throw new ForbiddenException(
          `Limite de tentativas excedido (${problem.maxAttempts}/${problem.maxAttempts}). A questão foi encerrada.`,
        );
      }
    }

    if (problem.deadline && new Date() > new Date(problem.deadline)) {
      throw new ForbiddenException(
        `O prazo para entrega desta atividade encerrou em ${new Date(problem.deadline).toLocaleString()}.`,
      );
    }

    let finalVerdict = 'Accepted';
    let executionStdout: string | null = null;
    let executionStderr: string | null = null;

    const judgeUrl = 'https://judge0-ce.p.rapidapi.com/submissions';
    const rapidApiKey = process.env.RAPIDAPI_KEY;

    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY não configurada.');
      finalVerdict = 'Internal Error';
    } else if (problem.testCases && problem.testCases.length > 0) {
      for (const testCase of problem.testCases) {
        try {
          const payload = {
            source_code: Buffer.from(code).toString('base64'),
            language_id: language_id,
            stdin: Buffer.from(testCase.input).toString('base64'),
            expected_output: Buffer.from(testCase.expectedOutput).toString(
              'base64',
            ),
          };

          const response = await axios.post(
            `${judgeUrl}?base64_encoded=true&wait=true`,
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
                'x-rapidapi-key': rapidApiKey,
              },
              timeout: 10000,
            },
          );

          const result = response.data;

          if (result.status.id !== 3) {
            finalVerdict = result.status.description;
            executionStdout = result.stdout
              ? Buffer.from(result.stdout, 'base64').toString()
              : null;
            executionStderr = result.stderr
              ? Buffer.from(result.stderr, 'base64').toString()
              : null;
            if (result.compile_output) {
              executionStderr = Buffer.from(
                result.compile_output,
                'base64',
              ).toString();
            }
            break;
          }
        } catch (error: any) {
          console.error(
            'Judge0 API Error:',
            error.response?.data || error.message,
          );
          finalVerdict = 'Execution Error';
          break;
        }
      }
    }

    const submission = this.submissionsRepository.create({
      code,
      language_id,
      status: finalVerdict,
      stdout: executionStdout,
      stderr: executionStderr,
      problem,
      user: { id: userId } as any,
    });

    return this.submissionsRepository.save(submission);
  }

  async findAllByProblem(problemId: string) {
    return this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async seedProblem() {
    return { msg: 'ok' };
  }

  async getTeacherStats(userId: number) {
    // Busca submissões onde o exercício pertence a uma turma cujo dono é o userId
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            owner: { id: userId },
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'], // Otimização: traz apenas o necessário
    });

    // Processamento dos dados para o formato do gráfico
    const statsMap = new Map<
      string,
      { name: string; Accepted: number; Error: number }
    >();

    submissions.forEach((sub) => {
      const problemTitle = sub.problem.title;

      if (!statsMap.has(problemTitle)) {
        statsMap.set(problemTitle, {
          name: problemTitle,
          Accepted: 0,
          Error: 0,
        });
      }

      const entry = statsMap.get(problemTitle);
      if (entry) {
        if (sub.status === 'Accepted') {
          entry.Accepted += 1;
        } else {
          entry.Error += 1; // Qualquer status que não seja Accepted conta como erro no gráfico
        }
      }
    });

    return Array.from(statsMap.values());
  }

  async getClassroomStats(classroomId: number, userId: number) {
    // Busca submissões apenas desta turma específica e valida se o usuário é o dono
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            id: classroomId,
            owner: { id: userId }, // Garante que só o dono vê os dados
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'],
    });

    // Se não retornar nada, pode ser que a turma não exista ou não tenha submissões.
    // O gráfico apenas ficará vazio, o que é o comportamento esperado.

    const statsMap = new Map<
      string,
      { name: string; Accepted: number; Error: number }
    >();

    submissions.forEach((sub) => {
      const problemTitle = sub.problem.title;

      if (!statsMap.has(problemTitle)) {
        statsMap.set(problemTitle, {
          name: problemTitle,
          Accepted: 0,
          Error: 0,
        });
      }

      const entry = statsMap.get(problemTitle);
      if (entry) {
        if (sub.status === 'Accepted') {
          entry.Accepted += 1;
        } else {
          entry.Error += 1;
        }
      }
    });

    return Array.from(statsMap.values());
  }
}
