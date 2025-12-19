import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  async create(createProblemDto: CreateProblemDto, userId: number) {
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

    const problem = this.problemsRepository.create({
      title: createProblemDto.title,
      description: createProblemDto.description,
      slug: createProblemDto.slug,
      classroom: classroom,
    });

    const savedProblem = await this.problemsRepository.save(problem);

    const testCases = createProblemDto.testCases.map((tc) =>
      this.testCasesRepository.create({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        problem: savedProblem,
      }),
    );

    await this.testCasesRepository.save(testCases);

    return savedProblem;
  }

  findAll() {
    return this.problemsRepository.find({ relations: ['classroom'] });
  }

  async findOne(id: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['testCases', 'classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');
    return problem;
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: number) {
    // 1. Buscar o problema existente com seus relacionamentos
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner', 'testCases'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    // 2. Validar permissão
    if (problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o dono da turma pode editar este exercício.',
      );
    }

    // 3. Separar os dados: testCases vs dados do problema
    const { testCases, classroomId, ...dataToUpdate } = updateProblemDto;

    // 4. Atualizar dados básicos do problema
    Object.assign(problem, dataToUpdate);
    await this.problemsRepository.save(problem);

    // 5. Atualizar os Casos de Teste (Estratégia: Substituição Completa)
    if (testCases) {
      // Remove os casos de teste antigos
      // AVISO: Isso apaga todos os testes anteriores deste problema
      await this.testCasesRepository.delete({ problem: { id: problem.id } });

      // Cria os novos casos de teste
      const newTestCases = testCases.map((tc) =>
        this.testCasesRepository.create({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          problem: problem,
        }),
      );

      await this.testCasesRepository.save(newTestCases);
    }

    return this.findOne(id); // Retorna o problema atualizado
  }

  async remove(id: string, userId: number) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    if (problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o dono da turma pode excluir este exercício.',
      );
    }

    return this.problemsRepository.remove(problem);
  }
}
