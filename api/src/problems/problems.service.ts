import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'; // Adicionados Imports
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { CreateProblemDto } from './dto/create-problem.dto';
import { Classroom } from '../classrooms/entities/classroom.entity';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    @InjectRepository(Classroom) // Injeção Correta
    private classroomsRepository: Repository<Classroom>,
  ) {}

  async create(createProblemDto: CreateProblemDto, userId: number) {
    // 1. Validar Turma e Dono
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

    // 2. Criar Problema vinculado à Turma
    const problem = this.problemsRepository.create({
      title: createProblemDto.title,
      description: createProblemDto.description,
      classroom: classroom,
    });

    const savedProblem = await this.problemsRepository.save(problem);

    const testCases = createProblemDto.testCases.map((tc) =>
      this.testCasesRepository.create({
        input: tc.input,
        expectedOutput: tc.expected_output, // <--- Mude a chave para expectedOutput
        problem: savedProblem,
      }),
    );

    await this.testCasesRepository.save(testCases);

    return savedProblem;
  }

  async findAll() {
    return this.problemsRepository.find({
      relations: ['testCases', 'classroom'],
    });
  }
}
