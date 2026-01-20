import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem, ProblemType } from '../problems/entities/problem.entity';
import { WrapperGenerator } from './wrapper-generator';

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
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            owner: { id: userId },
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'],
    });

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
        if (sub.status === 'Accepted') entry.Accepted += 1;
        else entry.Error += 1;
      }
    });

    return Array.from(statsMap.values());
  }

  async getClassroomStats(classroomId: number, userId: number) {
    const submissions = await this.submissionsRepository.find({
      where: {
        problem: {
          classroom: {
            id: classroomId,
            owner: { id: userId },
          },
        },
      },
      relations: ['problem'],
      select: ['id', 'status', 'problem'],
    });

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
        if (sub.status === 'Accepted') entry.Accepted += 1;
        else entry.Error += 1;
      }
    });

    return Array.from(statsMap.values());
  }

  async grade(id: string, gradeDto: GradeSubmissionDto, userId: number) {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: ['problem', 'problem.classroom', 'problem.classroom.owner'],
    });

    if (!submission) throw new NotFoundException('Submissão não encontrada');

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

async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    const { code, language_id, problem_id } = createSubmissionDto;

    // 1. Buscando o Problema
    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    // 2. Validação: Professor não submete
    if (problem.classroom.owner.id === userId) {
      throw new ForbiddenException(
        'Professores não devem enviar soluções para análise, apenas alunos.',
      );
    }

    // 3. Validação: Regras de Prova (Exam)
    if (problem.type === ProblemType.EXAM) {
      if (problem.maxAttempts) {
        const attempts = await this.submissionsRepository.count({
          where: { problem: { id: problem.id }, user: { id: userId } },
        });
        if (attempts >= problem.maxAttempts) {
          throw new ForbiddenException(`Limite de tentativas excedido.`);
        }
      }

      if (problem.timeLimit) {
        if (!problem.startedAt) {
          throw new ForbiddenException(
            'A prova ainda não foi iniciada pelo professor.',
          );
        }
        const now = new Date().getTime();
        const startTime = new Date(problem.startedAt).getTime();
        const limitMs = problem.timeLimit * 60 * 1000;
        const endTime = startTime + limitMs;
        if (now > endTime + 30000) {
          throw new ForbiddenException('O tempo da prova acabou.');
        }
      }
    }

    // 4. Validação: Prazo Geral
    if (problem.deadline && new Date() > new Date(problem.deadline)) {
      throw new ForbiddenException(`Prazo encerrado.`);
    }

    // 5. Preparação para Execução
    let finalVerdict = 'Accepted';
    let executionStdout: string | null = null;
    let executionStderr: string | null = null;

    const params =
      problem.parameters?.length > 0
        ? problem.parameters
        : ([
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
          ] as any);

    const returnType = problem.returnType || 'string';

    const codeToRun = WrapperGenerator.generate(
      language_id,
      params,
      returnType,
      code,
    );

    // URL DE PRODUÇÃO (Go-Judge na porta 5050)
    const judgeUrl = process.env.GO_JUDGE_URL || 'http://go-judge:5050/run';

    let langConfig;
    try {
      langConfig = this.getLanguageConfig(language_id);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }

    // 6. Loop de Testes
    if (problem.testCases?.length > 0) {
      for (const testCase of problem.testCases) {
        try {
          // --- AQUI ESTÁ A PARTE QUE VOCÊ PERGUNTOU ---
          // Criamos essa variável para garantir que o comando seja sempre um Array
          const commandToRun = Array.isArray(langConfig.runCommand) 
            ? langConfig.runCommand 
            : [langConfig.runCommand];

          const payload = {
            cmd: commandToRun, // Usamos a variável aqui
            files: [
              {
                name: langConfig.fileName,
                content: codeToRun,
              },
            ],
            stdin: testCase.input || "",
          };

          // Execução usando FETCH nativo (Recomendado para evitar bugs de JSON)
          const response = await fetch(judgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(
              `Go-Judge Error: ${response.status} ${response.statusText}`,
            );
          }

          // Go-Judge retorna um objeto único se enviamos objeto único
          const result: any = await response.json();

          // 6.1 Verifica Erros de Execução/Compilação
          if (result.status !== 'Accepted') {
            finalVerdict = result.status;
            executionStdout = result.files?.stdout || '';
            executionStderr = result.files?.stderr || '';

            if (result.exitStatus !== 0 && finalVerdict === 'Accepted') {
              finalVerdict = 'Runtime Error';
            }
            break; 
          }

          // 6.2 Comparação de Saída
          const actualOutput = (result.files?.stdout || '').trim();
          const expectedOutput = (testCase.expectedOutput || '').trim();

          if (actualOutput !== expectedOutput) {
            finalVerdict = 'Wrong Answer';
            executionStdout = actualOutput;
            break;
          }
        } catch (e) {
          console.error('Erro de comunicação com Go-Judge:', e.message);
          finalVerdict = 'Internal Error';
          executionStderr = 'Falha ao comunicar com o servidor de execução.';
          break;
        }
      }
    }

    // 7. Salvar Submissão
    const sub = this.submissionsRepository.create({
      code,
      language_id,
      status: finalVerdict,
      stdout: executionStdout,
      stderr: executionStderr,
      problem,
      user: { id: userId } as any,
    });

    return this.submissionsRepository.save(sub);
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

  private getLanguageConfig(languageId: number) {
    switch (languageId) {
      case 71: // Python
        return {
          fileName: 'main.py',
          runCommand: ['python3', 'main.py'],
        };

      case 63: // JavaScript (Node)
        return {
          fileName: 'index.js',
          runCommand: ['node', 'index.js'],
        };

      case 62: // Java
        return {
          fileName: 'Main.java',
          runCommand: ['java', 'Main.java'],
        };
      case 60: // Go (Golang)
      case 95: // Go (Versões mais novas) - Adicione por segurança
        return {
          fileName: 'main.go',
          runCommand: ['go', 'run', 'main.go'],
        };

      default:
        throw new Error(`Linguagem ID ${languageId} não suportada.`);
    }
  }
}
