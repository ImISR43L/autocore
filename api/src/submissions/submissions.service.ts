import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem, ProblemType } from '../problems/entities/problem.entity'; // Importe o Enum
import { GradeSubmissionDto } from './dto/grade-submission.dto'; // Importe o DTO

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
  ) {}

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
        // Retorna um erro amigável ou lança exceção.
        // Lançar exceção impede a criação da linha no banco, o que é ideal.
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
      // Log para debug do servidor apenas
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

          // Captura dados da execução atual
          const result = response.data;

          // Se houver erro ou resposta errada, capturamos o output e paramos
          if (result.status.id !== 3) {
            finalVerdict = result.status.description;
            // Decodifica Base64 se existir
            executionStdout = result.stdout
              ? Buffer.from(result.stdout, 'base64').toString()
              : null;
            executionStderr = result.stderr
              ? Buffer.from(result.stderr, 'base64').toString()
              : null;

            // Se for erro de compilação, o stderr costuma vir no campo 'compile_output'
            if (result.compile_output) {
              executionStderr = Buffer.from(
                result.compile_output,
                'base64',
              ).toString();
            }
            break;
          }
        } catch (error) {
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
      stdout: executionStdout, // Salva o output
      stderr: executionStderr, // Salva o erro
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

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!submission) {
      throw new NotFoundException('Submissão não encontrada');
    }

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
}
