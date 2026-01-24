import {
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class ProblemsService {
  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(createProblemDto: CreateProblemDto, _userId: number) {
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
      deadline: deadline ? new Date(deadline) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      timeLimit: timeLimit,
      // CORREÇÃO: Cast explícito para satisfazer a tipagem estrita da Entidade
      parameters: parameters as any,
      classroom: { id: classroomId },
    });

    if (questions && questions.length > 0) {
      problem.children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: { id: classroomId },
          // CORREÇÃO: Cast explícito
          parameters: q.parameters as any,
          testCases: q.testCases.map((tc) =>
            this.testCasesRepository.create({ ...tc }),
          ),
        }),
      );
    } else if (testCases && testCases.length > 0) {
      problem.testCases = testCases.map((tc) =>
        this.testCasesRepository.create({ ...tc }),
      );
    }

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

    // Se o usuário NÃO é o dono da turma (é Aluno ou outro Professor), aplicamos restrições.
    if (problem.classroom && problem.classroom.owner.id !== userId) {
      // 1. LÓGICA ESPECÍFICA DE PROVA (Bloqueio de Acesso)
      if (problem.type === ProblemType.EXAM) {
        // Se a prova não tem data de início ou a data é futura -> Bloqueia
        if (!problem.startedAt || problem.startedAt > new Date()) {
          throw new ForbiddenException(
            'Esta prova ainda não foi iniciada pelo professor. Aguarde o início.',
          );
        }
      }

      // Aplica-se a TODOS os tipos (Exercícios e Provas)

      // Filtra os casos de teste do problema principal (se houver)
      if (problem.testCases) {
        problem.testCases = problem.testCases.filter((tc) => !tc.isHidden);
      }

      // Filtra os casos de teste das questões filhas (importante para Provas com múltiplas questões)
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

    // 1. Uso do userId para validação de segurança
    if (problem.classroom && problem.classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode editar.');
    }

    const {
      questions,
      testCases,
      parameters,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      classroomId: _classroomId, // Removido da lógica, mas extraído para não ir para o assign
      deadline,
      startDate,
      ...dataToUpdate
    } = updateProblemDto;

    // Atualização de Questões (Prova)
    if (questions) {
      if (problem.children.length > 0) {
        await this.problemsRepository.remove(problem.children);
      }

      problem.children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: problem.classroom,
          parameters: q.parameters as unknown as ParameterDefinition[],
          testCases: q.testCases.map((tc) =>
            this.testCasesRepository.create({ ...tc }),
          ),
        }),
      );
    }

    // 3. Atualização de TestCases (Exercício Simples) - AGORA IMPLEMENTADO
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
