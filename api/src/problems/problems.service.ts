import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { DryRunDto } from './dto/dry-run.dto';
import {
  ParameterDefinition,
  Problem,
  ProblemType,
} from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { WrapperGenerator } from '../submissions/wrapper-generator';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  private readonly executorUrl =
    process.env.EXECUTOR_URL || 'http://go-judge:5050/run';

  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  private compareOutputs(actual: string, expected: string): boolean {
    this.logger.debug(
      `[COMPARE-START]\nActual (Raw):   ${JSON.stringify(actual)}\nExpected (Raw): ${JSON.stringify(expected)}`,
    );

    if (!actual && !expected) return true;
    if (!actual || !expected) {
      this.logger.debug(`[COMPARE-FAIL] Um dos valores é vazio.`);
      return false;
    }

    // 1. Limpeza básica
    const clean = (s: string) =>
      s
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
    const a = clean(actual);
    const e = clean(expected);

    if (a === e) {
      this.logger.debug(`[COMPARE-SUCCESS] Match exato após trim.`);
      return true;
    }

    // 2. Comparação Linha a Linha
    const aLines = a.split('\n').map((l) => l.trimEnd());
    const eLines = e.split('\n').map((l) => l.trimEnd());
    if (
      aLines.length === eLines.length &&
      aLines.every((line, i) => line === eLines[i])
    ) {
      this.logger.debug(`[COMPARE-SUCCESS] Match linha a linha.`);
      return true;
    }

    // 3. Comparação Semântica (JSON)
    try {
      const objA = JSON.parse(a);
      const objE = JSON.parse(e);
      if (JSON.stringify(objA) === JSON.stringify(objE)) {
        this.logger.debug(`[COMPARE-SUCCESS] Match via JSON Parse.`);
        return true;
      }
    } catch {
      // Ignora erro
    }

    // 4. Normalização Canônica (Agressiva)
    const normalize = (str: string) => {
      return str
        .replace(/\s+/g, '') // Remove TODOS os espaços/newlines
        .replace(/[\u2018\u2019]/g, "'") // Padroniza Smart Quotes Simples
        .replace(/[\u201C\u201D]/g, '"') // Padroniza Smart Quotes Duplas
        .replace(/'/g, '"') // Transforma aspas simples em duplas
        .replace(/\(/g, '[') // Tupla -> Array
        .replace(/\)/g, ']')
        .replace(/\bTrue\b/g, 'true') // Python Booleans
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/;$/, '');
    };

    const normA = normalize(a);
    const normE = normalize(e);

    this.logger.debug(
      `[COMPARE-NORM]\nNorm Actual:   "${normA}"\nNorm Expected: "${normE}"\nIguais?        ${normA === normE}`,
    );

    if (normA === normE) {
      this.logger.debug(`[COMPARE-SUCCESS] Match após normalização.`);
      return true;
    }

    this.logger.debug(`[COMPARE-FAIL] Nenhuma estratégia funcionou.`);
    return false;
  }

  async create(createProblemDto: CreateProblemDto) {
    const {
      classroomId,
      questions,
      parameters,
      startDate,
      deadline,
      ...problemData
    } = createProblemDto;

    if (!classroomId) {
      throw new BadRequestException(
        'A vinculação a uma turma (classroomId) é obrigatória.',
      );
    }

    const classroom = await this.classroomsRepository.findOne({
      where: { id: String(classroomId) },
    });

    if (!classroom) {
      throw new NotFoundException('Turma não encontrada.');
    }

    if (classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    const existingProblem = await this.problemsRepository.findOne({
      where: {
        slug: createProblemDto.slug,
        classroom: { id: createProblemDto.classroomId },
      },
    });

    if (existingProblem) {
      throw new ConflictException('Este slug já está em uso nesta turma.');
    }

    let children: Problem[] = [];
    if (questions && questions.length > 0) {
      children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          slug: `${createProblemDto.slug}--${q.slug}`, // ex: "prova-1--q1"
          type: ProblemType.EXERCISE,
          classroom: classroom,
          parameters: q.parameters as unknown as ParameterDefinition[],
          starterCode: q.starterCode as any,
          solutionCode: q.solutionCode as any,
          testCases: q.testCases
            ? q.testCases.map((tc) =>
                this.testCasesRepository.create({ ...tc }),
              )
            : [],
        }),
      );
    }

    const problem = this.problemsRepository.create({
      ...problemData,
      startDate: startDate ? new Date(startDate) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      parameters: parameters as unknown as ParameterDefinition[],
      starterCode: problemData.starterCode as any,
      solutionCode: problemData.solutionCode as any,
      classroom: classroom,
      children: children.length > 0 ? children : undefined,
    });

    return this.problemsRepository.save(problem);
  }

  async findAll() {
    const problems = await this.problemsRepository.find({
      relations: ['classroom'],
    });

    // Proteção de dados: Ocultar gabarito em listagens públicas
    problems.forEach((problem) => {
      delete (problem as any).solutionCode;
    });

    return problems;
  }

  async findOne(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: [
        'testCases',
        'children',
        'children.testCases',
        'classroom',
        'classroom.owner',
      ],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (
      problem.type === ProblemType.EXAM &&
      !problem.startedAt &&
      problem.startDate &&
      problem.startDate <= new Date()
    ) {
      this.logger.log(
        `[AutoStart] Iniciando prova ${problem.id} automaticamente.`,
      );
      problem.startedAt = problem.startDate;
      await this.problemsRepository.save(problem);
    }

    const isOwner =
      problem.classroom &&
      String(problem.classroom.owner?.id) === String(userId);

    if (!isOwner) {
      delete (problem as any).solutionCode;

      if (problem.children && problem.children.length > 0) {
        problem.children.forEach((child) => delete (child as any).solutionCode);
      }

      if (problem.type === ProblemType.EXAM) {
        const now = new Date();
        if (!problem.startedAt || problem.startedAt > now) {
          throw new ForbiddenException(
            'Esta prova ainda não foi iniciada pelo professor.',
          );
        }
      }

      if (problem.testCases) {
        problem.testCases = problem.testCases.filter((tc) => !tc.isHidden);
      }
      if (problem.children && problem.children.length > 0) {
        problem.children.forEach((child) => {
          if (child.testCases) {
            child.testCases = child.testCases.filter((tc) => !tc.isHidden);
          }
        });
      }
    }

    return problem;
  }

  async startExam(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Prova não encontrada');

    if (problem.classroom.owner?.id !== userId)
      throw new ForbiddenException('Apenas o professor pode iniciar.');

    if (problem.type !== ProblemType.EXAM)
      throw new ForbiddenException('Apenas provas podem ser iniciadas.');

    problem.startedAt = new Date();
    return this.problemsRepository.save(problem);
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['children', 'testCases', 'classroom', 'classroom.owner'],
    });
    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (!problem.classroom) {
      throw new ForbiddenException(
        'Atividades sem turma não possuem proprietário e não podem ser editadas.',
      );
    }

    if (problem.classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    if (problem.classroom.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode editar.');
    }

    const {
      questions,
      testCases,
      parameters,
      classroomId: _classroomId,
      deadline,
      startDate,
      slug,
      ...dataToUpdate
    } = updateProblemDto;

    // Limpeza rigorosa para evitar que TypeORM sobrescreva campos estruturais no Object.assign
    delete (dataToUpdate as any).startedAt;
    delete (dataToUpdate as any).createdAt;
    delete (dataToUpdate as any).updatedAt;
    delete (dataToUpdate as any).id;
    delete (dataToUpdate as any).classroom;
    delete (dataToUpdate as any).children;

    if (questions) {
      if (problem.children && problem.children.length > 0) {
        await this.problemsRepository.remove(problem.children);
      }

      problem.children = questions.map((q) => {
        const childParams = q.parameters as unknown as ParameterDefinition[];
        const childTestCases = q.testCases
          ? q.testCases.map((tc) => {
              delete (tc as any).id; // Remove ID para forçar INSERT real
              return this.testCasesRepository.create({ ...tc });
            })
          : [];

        delete (q as any).id; // Remove ID para forçar INSERT real
        delete (q as any).classroom;
        delete (q as any).children;

        return this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: problem.classroom,
          parameters: childParams,
          slug: `${updateProblemDto.slug ?? problem.slug}--${q.slug}`,
          starterCode: q.starterCode as any,
          solutionCode: q.solutionCode as any,
          testCases: childTestCases,
        }) as unknown as Problem;
      });
    }

    if (testCases) {
      if (problem.testCases && problem.testCases.length > 0) {
        await this.testCasesRepository.remove(problem.testCases);
      }
      problem.testCases = testCases.map((tc) => {
        delete (tc as any).id; // Remove ID para forçar INSERT real
        return this.testCasesRepository.create({ ...tc });
      });
    }

    if (parameters) {
      problem.parameters = parameters as unknown as ParameterDefinition[];
    }

    if (deadline !== undefined) {
      problem.deadline = (deadline ? new Date(deadline) : null) as any;
    }
    if (startDate !== undefined) {
      problem.startDate = (startDate ? new Date(startDate) : null) as any;
    }

    Object.assign(problem, {
      ...dataToUpdate,
      starterCode: dataToUpdate.starterCode as any,
      solutionCode: dataToUpdate.solutionCode as any,
    });

    return this.problemsRepository.save(problem);
  }

  async remove(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (!problem.classroom) {
      throw new ForbiddenException(
        'Atividades sem turma não possuem proprietário e não podem ser excluídas.',
      );
    }

    if (problem.classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    if (problem.classroom.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode excluir.');
    }

    return this.problemsRepository.remove(problem);
  }

  async dryRun(dto: DryRunDto) {
    this.logger.log(`[DryRun] Iniciando execução para ${dto.language}`);

    const langConfig = this.getLanguageConfig(dto.language);
    if (!langConfig) {
      throw new InternalServerErrorException(
        `Linguagem ${dto.language} não suportada para Dry Run.`,
      );
    }

    const tempProblem = {
      parameters: dto.parameters as unknown as ParameterDefinition[],
      returnType: (dto as any).returnType || 'void',
    } as Problem;

    // Clone profundo para não afetar o payload original
    const filesClone = JSON.parse(JSON.stringify(dto.starterCode));

    // LIMPEZA CRÍTICA: Remove resíduos de wrappers antigos armazenados na BD ou cache
    filesClone.forEach((f: any) => {
      if (f.content) {
        const jsCppIndex = f.content.indexOf('// --- Wrapper Injetado');
        const pyIndex = f.content.indexOf('# --- Wrapper Injetado');

        if (jsCppIndex !== -1) {
          f.content = f.content.substring(0, jsCppIndex).trim();
        }
        if (pyIndex !== -1) {
          f.content = f.content.substring(0, pyIndex).trim();
        }
      }
    });

    // Aplica o Wrapper Inteligente no código purificado
    const processedFiles = WrapperGenerator.apply(
      filesClone,
      tempProblem,
      langConfig.id,
    );

    const mainFile = processedFiles.find((f) =>
      f.name.endsWith(langConfig.ext),
    );
    if (!mainFile) {
      throw new InternalServerErrorException(
        'Arquivo principal não encontrado após processamento.',
      );
    }

    const promises = dto.testCases.map(async (tc, index) => {
      try {
        const result = await this.executeInGoJudge(
          langConfig,
          processedFiles,
          tc.input,
        );

        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = tc.expectedOutput.trim();

        const status = this.compareOutputs(actualOutput, expectedOutput)
          ? 'ACCEPTED'
          : 'WRONG_ANSWER';

        return {
          id: index,
          status,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: actualOutput,
          error: result.stderr || result.error,
          executionTime: result.time ? `${result.time / 1000000}ms` : '0ms',
          memory: result.memory
            ? `${(result.memory / 1024 / 1024).toFixed(2)}MB`
            : '0MB',
        };
      } catch (error) {
        this.logger.error(
          `[DryRun] Erro no caso ${index}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          id: index,
          status: 'INTERNAL_ERROR',
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          error: 'Falha na comunicação com o executor.',
        };
      }
    });

    const results = await Promise.all(promises);

    return {
      success: results.every((r) => r.status === 'ACCEPTED'),
      results,
    };
  }

  private getLanguageConfig(lang: string) {
    const map: Record<
      string,
      { id: number; runCommand: string[]; ext: string }
    > = {
      python: {
        id: 71,
        ext: '.py',
        runCommand: ['python3', '-u', 'main.py'],
      },
      javascript: {
        id: 63,
        ext: '.js',
        runCommand: ['node', 'index.js'],
      },
      cpp: {
        id: 54,
        ext: '.cpp',
        runCommand: ['/bin/sh', '-c', 'g++ main.cpp -o main && ./main'],
      },
    };
    return map[lang.toLowerCase()] || null;
  }

  private async executeInGoJudge(
    config: { runCommand: string[]; ext: string },
    files: { name: string; content: string }[],
    stdin: string,
  ) {
    const copyIn: Record<string, { content: string }> = {};
    files.forEach((f) => {
      copyIn[f.name] = { content: f.content };
    });

    const payload = {
      cmd: [
        {
          args: config.runCommand,
          env: ['PATH=/usr/bin:/bin'],
          files: [
            { content: stdin },
            { name: 'stdout', max: 10240 },
            { name: 'stderr', max: 10240 },
          ],
          cpuLimit: 2000000000,
          memoryLimit: 128 * 1024 * 1024,
          procLimit: 50,
          copyIn,
        },
      ],
    };

    const { data } = await axios.post(this.executorUrl, payload);
    const result = data[0];

    if (result.status !== 'Accepted') {
      return {
        ...result,
        stdout: result.files['stdout'],
        stderr: result.files['stderr'] || `Erro de execução: ${result.status}`,
      };
    }

    return {
      ...result,
      stdout: result.files['stdout'],
      stderr: result.files['stderr'],
    };
  }
}
