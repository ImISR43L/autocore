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
      ...problemData
    } = createProblemDto;

    const problem = this.problemsRepository.create({
      ...problemData,
      type: type as ProblemType,
      deadline: (deadline ? new Date(deadline) : null) as any,
      timeLimit: timeLimit,
      parameters: parameters as any,
      classroom: { id: classroomId } as any,
    });

    const savedProblem = await this.problemsRepository.save(problem);

    if (testCases && testCases.length > 0) {
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
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) {
      throw new NotFoundException('Problema não encontrado');
    }

    const isOwner = problem.classroom.owner.id === userId;

    if (!isOwner && problem.testCases) {
      problem.testCases = problem.testCases.map((tc) => {
        if (tc.isHidden) {
          return {
            ...tc,
            input: '🔒 [Oculto]',
            expectedOutput: '🔒 [Oculto]',
          };
        }
        return tc;
      });
    }

    return problem;
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o dono da turma pode editar este exercício.',
      );
    }

    const {
      testCases,
      classroomId,
      deadline,
      type,
      parameters,
      ...dataToUpdate
    } = updateProblemDto;

    if (type) problem.type = type as ProblemType;
    if (deadline) problem.deadline = new Date(deadline);

    if (parameters) problem.parameters = parameters as any;

    Object.assign(problem, dataToUpdate);

    if (testCases) {
      await this.testCasesRepository.delete({ problem: { id: problem.id } });

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
