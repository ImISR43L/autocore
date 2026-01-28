import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import {
  ParameterDefinition,
  Problem,
  ProblemType,
} from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  async create(createProblemDto: CreateProblemDto) {
    // 1. Extrair parameters para tratar a tipagem separadamente
    const { classroomId, questions, parameters, ...problemData } =
      createProblemDto;

    let classroom: Classroom | undefined = undefined;
    if (classroomId) {
      const foundClassroom = await this.classroomsRepository.findOne({
        where: { id: classroomId },
      });
      if (!foundClassroom) throw new NotFoundException('Turma não encontrada');
      classroom = foundClassroom;
    }

    let children: Problem[] = [];
    if (questions && questions.length > 0) {
      children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: ProblemType.EXERCISE,
          classroom: classroom,
          // Cast explícito para resolver incompatibilidade DTO (string) vs Entidade (Union)
          parameters: q.parameters as unknown as ParameterDefinition[],
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
      // Cast explícito também para o problema principal
      parameters: parameters as unknown as ParameterDefinition[],
      classroom: classroom,
      children: children.length > 0 ? children : undefined,
    });

    return this.problemsRepository.save(problem);
  }

  async findAll() {
    return this.problemsRepository.find({ relations: ['classroom'] });
  }

  async findOne(id: string, userId: number) {
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

    if (problem.classroom && problem.classroom.owner.id !== userId) {
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

  async startExam(id: string, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Prova não encontrada');
    if (problem.classroom.owner.id !== userId)
      throw new ForbiddenException('Apenas o professor pode iniciar.');
    if (problem.type !== ProblemType.EXAM)
      throw new ForbiddenException('Apenas provas podem ser iniciadas.');

    problem.startedAt = new Date();
    return this.problemsRepository.save(problem);
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['children', 'testCases', 'classroom', 'classroom.owner'],
    });
    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.classroom && problem.classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode editar.');
    }

    const {
      questions,
      testCases,
      parameters,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      classroomId: _classroomId,
      deadline,
      startDate,
      ...dataToUpdate
    } = updateProblemDto;

    delete (dataToUpdate as any).startedAt;

    if (questions) {
      if (problem.children && problem.children.length > 0) {
        await this.problemsRepository.remove(problem.children);
      }

      // 2. CORREÇÃO: Cast 'as unknown as Problem' para evitar o erro de conversão
      problem.children = questions.map((q) => {
        const childParams = q.parameters as unknown as ParameterDefinition[];
        const childTestCases = q.testCases
          ? q.testCases.map((tc) => this.testCasesRepository.create({ ...tc }))
          : [];

        return this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: problem.classroom,
          parameters: childParams,
          testCases: childTestCases,
        }) as unknown as Problem; // <--- CORREÇÃO AQUI
      });
    }

    if (testCases) {
      if (problem.testCases && problem.testCases.length > 0) {
        await this.testCasesRepository.remove(problem.testCases);
      }
      problem.testCases = testCases.map((tc) =>
        this.testCasesRepository.create({ ...tc }),
      );
    }

    if (parameters) {
      problem.parameters = parameters as unknown as ParameterDefinition[];
    }
    if (deadline) problem.deadline = new Date(deadline);
    if (startDate) problem.startDate = new Date(startDate);

    Object.assign(problem, dataToUpdate);

    return this.problemsRepository.save(problem);
  }

  async remove(id: string, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.classroom && problem.classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode excluir.');
    }

    return this.problemsRepository.remove(problem);
  }
}
