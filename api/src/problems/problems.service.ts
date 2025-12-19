import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { UpdateProblemDto } from './dto/update-problem.dto';
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
      slug: createProblemDto.slug, // <--- GARANTA QUE ISTO ESTÁ AQUI
      classroom: classroom,
    });

    const savedProblem = await this.problemsRepository.save(problem);

    // 3. Salvar Casos de Teste
    const testCases = createProblemDto.testCases.map((tc) =>
      this.testCasesRepository.create({
        input: tc.input,
        expectedOutput: tc.expectedOutput, // Padronize camelCase
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

  async findOne(id: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['testCases', 'classroom', 'classroom.owner'], // <--- ADICIONE 'testCases'
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');
    return problem;
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: number) {
    // 1. Buscar o problema e a turma (com o dono)
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    // 2. Verificar se o usuário é o dono da turma
    if (problem.classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o dono da turma pode editar este exercício.',
      );
    }

    // 3. Atualizar campos básicos
    // Nota: Atualizar testCases é mais complexo, por enquanto vamos focar nos dados básicos
    const { testCases, classroomId, ...dataToUpdate } = updateProblemDto;

    Object.assign(problem, dataToUpdate);

    return this.problemsRepository.save(problem);
  }

  // ADICIONE ESTE MÉTODO:
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
