import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Problem, ProblemType } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
  ) {}

  async create(createProblemDto: CreateProblemDto, userId: number) {
    const {
      testCases,
      classroomId,
      type,
      deadline,
      parameters,
      timeLimit,
      questions,
      startDate,
      ...problemData
    } = createProblemDto;

    const problem = this.problemsRepository.create({
      ...problemData,
      type: type as ProblemType,
      deadline: (deadline ? new Date(deadline) : null) as any,
      startDate: (startDate ? new Date(startDate) : null) as any, // <--- Salvar
      timeLimit: timeLimit,
      parameters: parameters as any,
      classroom: { id: classroomId } as any,
    });

    // Se for Prova com Múltiplas Questões
    if (questions && questions.length > 0) {
      problem.children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: type as ProblemType,
          classroom: { id: classroomId } as any,
          parameters: q.parameters as any,
          testCases: q.testCases.map((tc) =>
            this.testCasesRepository.create({ ...tc }),
          ),
        }),
      );
    }

    const savedProblem = await this.problemsRepository.save(problem);

    // Se for Exercício Simples (Test Cases no Pai)
    if (testCases && testCases.length > 0 && !questions) {
      const cases = testCases.map((tc) =>
        this.testCasesRepository.create({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden || false,
          problem: savedProblem,
        }),
      );
      await this.testCasesRepository.save(cases);
    }

    return savedProblem;
  }

  async findOne(id: string, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: [
        'testCases',
        'classroom',
        'classroom.owner',
        'children',
        'children.testCases',
      ],
      order: {
        children: {
          createdAt: 'ASC',
        },
      },
    });

    if (!problem) {
      throw new NotFoundException('Problema não encontrado');
    }

    const isOwner = problem.classroom.owner.id === userId;

    const hideTests = (p: Problem) => {
      if (!isOwner && p.testCases) {
        p.testCases = p.testCases.map((tc) => ({
          ...tc,
          input: tc.isHidden ? '🔒 [Oculto]' : tc.input,
          expectedOutput: tc.isHidden ? '🔒 [Oculto]' : tc.expectedOutput,
        }));
      }
    };

    hideTests(problem);
    if (problem.children) {
      problem.children.forEach((child) => hideTests(child));
    }

    return problem;
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner', 'children'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o dono pode editar.');
    }

    const {
      testCases,
      classroomId,
      deadline,
      type,
      startDate,
      parameters,
      questions,
      ...dataToUpdate
    } = updateProblemDto;

    // Atualiza campos simples do Pai
    if (type) problem.type = type as ProblemType;
    if (deadline) problem.deadline = new Date(deadline);
    if (parameters) problem.parameters = parameters as any;
    if (startDate) problem.startDate = new Date(startDate);
    Object.assign(problem, dataToUpdate);

    // 1. Atualização de Exercício Simples (Test Cases no Pai)
    if (testCases) {
      // Remove antigos
      await this.testCasesRepository.delete({ problem: { id: problem.id } });
      // Cria novos
      const cases = testCases.map((tc) =>
        this.testCasesRepository.create({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden || false,
          problem: problem,
        }),
      );
      await this.testCasesRepository.save(cases);
    }

    // 2. Atualização de Prova Múltipla (Questões Filhas)
    if (questions) {
      // Remove filhos antigos (Reset da estrutura da prova)
      // Nota: Isso apaga submissões antigas atreladas às questões filhas.
      // Em produção Alpha, idealmente faríamos "Soft Delete" ou "Diff Update".
      if (problem.children.length > 0) {
        await this.problemsRepository.remove(problem.children);
      }

      // Cria novas questões filhas
      problem.children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: problem.classroom,
          parameters: q.parameters as any,
          testCases: q.testCases.map((tc) =>
            this.testCasesRepository.create({ ...tc }),
          ),
        }),
      );
    }

    if (parameters) problem.parameters = parameters as any;
    Object.assign(problem, dataToUpdate);

    return this.problemsRepository.save(problem);
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

  async findAll() {
    return this.problemsRepository.find();
  }

  async remove(id: string) {
    await this.problemsRepository.delete(id);
    return { deleted: true };
  }
}
