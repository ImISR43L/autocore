import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from '../submissions/entities/problem.entity';
import { TestCase } from '../submissions/entities/test-case.entity';
import { CreateProblemDto } from './dto/create-problem.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
  ) {}

  async create(createProblemDto: CreateProblemDto, userId: number) {
    // Recebe userId

    // 1. Verifica se o usuário é dono da turma
    const classroom = await this.classroomsRepository.findOne({
      where: { id: createProblemDto.classroomId },
      relations: ['owner'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    if (classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o professor (dono) desta turma pode criar exercícios nela.',
      );
    }

    // 2. Cria o problema vinculado à turma
    const problem = this.problemsRepository.create({
      title: createProblemDto.title,
      description: createProblemDto.description,
      classroom: classroom, // Vincula
    });

    const savedProblem = await this.problemsRepository.save(problem);

    // 2. Cria os Casos de Teste vinculados
    const testCases = createProblemDto.testCases.map((tc) =>
      this.testCasesRepository.create({
        input: tc.input,
        expected_output: tc.expected_output,
        problem: savedProblem,
      }),
    );

    await this.testCasesRepository.save(testCases);

    return savedProblem;
  }

  async findAll() {
    return this.problemsRepository.find({ relations: ['testCases'] });
  }
}
