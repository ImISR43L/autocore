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
      parameters: parameters as any,
      classroom: { id: classroomId },
    });

    if (questions && questions.length > 0) {
      problem.children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          type: problem.type,
          classroom: { id: classroomId },
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

    // === CORREÇÃO 1: AUTO-START (Garante liberação no horário agendado) ===
    // Se a data agendada (startDate) já passou, mas startedAt está vazio,
    // iniciamos automaticamente usando o horário agendado.
    if (
      problem.type === ProblemType.EXAM &&
      !problem.startedAt &&
      problem.startDate &&
      problem.startDate <= new Date()
    ) {
      console.log(`[AutoStart] Iniciando prova ${problem.id} automaticamente.`);
      problem.startedAt = problem.startDate;
      await this.problemsRepository.save(problem);
    }

    // Se o usuário NÃO é o dono da turma (é Aluno ou outro Professor)
    if (problem.classroom && problem.classroom.owner.id !== userId) {
      if (problem.type === ProblemType.EXAM) {
        
        // Debug: Ajuda a entender por que está bloqueando
        const now = new Date();
        if (!problem.startedAt || problem.startedAt > now) {
          console.log(`[Bloqueio] Prova: ${problem.title}`);
          console.log(`- StartedAt: ${problem.startedAt}`);
          console.log(`- Agora (Server): ${now}`);
          
          throw new ForbiddenException(
            'Esta prova ainda não foi iniciada pelo professor.',
          );
        }
      }

      // Filtros de segurança (Ocultar casos de teste)
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

    // Início Manual: Define para AGORA
    problem.startedAt = new Date();
    console.log(`[ManualStart] Prova ${problem.id} iniciada em ${problem.startedAt}`);
    
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

    // === CORREÇÃO 2: PROTEÇÃO CONTRA RESET ===
    // Remove startedAt do payload para garantir que ele nunca seja setado como null
    // por uma edição acidental do professor.
    delete (dataToUpdate as any).startedAt;

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