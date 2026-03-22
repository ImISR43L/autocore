import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { Classroom } from './entities/classroom.entity';
import { User } from '../users/entities/user.entity';
import { customAlphabet } from 'nanoid';

@Injectable()
export class ClassroomsService {
  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createClassroomDto: CreateClassroomDto, ownerId: string) {
    // IMPLEMENTAÇÃO NANOID
    // Alfabeto personalizado: Removemos 0, O, I, L para evitar confusão visual
    const generateCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 6);

    // Gera o código.
    const code = generateCode();

    const owner = await this.usersRepository.findOne({
      where: { id: ownerId },
    });
    if (!owner) throw new NotFoundException('Usuário não encontrado');

    const classroom = this.classroomsRepository.create({
      ...createClassroomDto,
      code,
      owner,
    });

    const savedClassroom = await this.classroomsRepository.save(classroom);

    return {
      ...savedClassroom,
      isOwner: true,
    };
  }

  async joinClassroom(code: string, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { code },
      relations: ['owner', 'students'],
    });

    if (!classroom) throw new NotFoundException('Código inválido');

    if (classroom.owner.id === userId) {
      throw new ForbiddenException(
        'Você é o professor desta turma e não pode entrar como aluno.',
      );
    }

    const alreadyEnrolled = classroom.students.some((s) => s.id === userId);
    if (alreadyEnrolled) {
      throw new ConflictException('Você já está matriculado nesta turma.');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário inválido');

    classroom.students.push(user);
    await this.classroomsRepository.save(classroom);
    return { status: 'joined', classroomId: classroom.id };
  }

  async findAll(userId: string) {
    const teaching = await this.classroomsRepository.find({
      where: { owner: { id: userId }, isArchived: false },
      relations: ['owner', 'problems'],
    });

    const enrolled = await this.classroomsRepository.find({
      where: { students: { id: userId }, isArchived: false },
      relations: ['owner', 'problems'],
    });

    const now = new Date();

    return [
      ...teaching.map((c) => ({ ...c, isOwner: true })),
      ...enrolled.map((c) => {
        if (c.problems) {
          c.problems = c.problems.filter((p) => {
            if (p.parent) return false;
            if (p.startedAt) return true;
            if (p.startDate && new Date(p.startDate) > now) return false;
            return true;
          });
        }
        return { ...c, isOwner: false };
      }),
    ];
  }

  async findOne(id: string, userId?: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: [
        'owner',
        'students',
        'problems',
        'problems.parent',
        'problems.testCases',
        'announcements',
        'announcements.author',
      ],
      order: {
        createdAt: 'DESC',
        problems: { createdAt: 'DESC' },
        announcements: { createdAt: 'DESC' },
      } as any,
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    if (userId && classroom.owner.id !== userId) {
      if (classroom.students) {
        classroom.students = classroom.students.map((student) => {
          const { email, ...safeStudent } = student;
          return safeStudent as User;
        });
      }

      const now = new Date();

      if (classroom.problems) {
        classroom.problems = classroom.problems.filter((p) => {
          if (p.parent) return false;

          // PRIORIDADE PARA INÍCIO MANUAL: Se a atividade/prova já foi iniciada manualmente
          if (p.startedAt) return true;

          // Se tiver agendamento futuro (startDate) e AINDA não começou, oculta do aluno
          if (p.startDate && new Date(p.startDate) > now) return false;

          return true;
        });

        classroom.problems.forEach((p) => {
          if (p.testCases) {
            p.testCases = p.testCases.map((tc) => {
              if (tc.isHidden) {
                return { ...tc, input: '🔒', expectedOutput: '🔒' } as any;
              }
              return tc;
            });
          }
        });
      }
    }

    return classroom;
  }

  async leave(id: string, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['students'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    const initialCount = classroom.students.length;
    classroom.students = classroom.students.filter(
      (student) => student.id !== userId,
    );

    if (classroom.students.length === initialCount) {
      throw new NotFoundException('Você não faz parte desta turma.');
    }

    return this.classroomsRepository.save(classroom);
  }

  async findArchived(userId: string) {
    const archived = await this.classroomsRepository.find({
      where: { owner: { id: userId }, isArchived: true },
      relations: ['owner', 'problems'],
    });

    return archived.map((c) => ({ ...c, isOwner: true }));
  }

  async archive(id: string, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');
    if (classroom.owner.id !== userId)
      throw new ForbiddenException('Ação não permitida');

    classroom.isArchived = true;
    return this.classroomsRepository.save(classroom);
  }

  async restore(id: string, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');
    if (classroom.owner.id !== userId)
      throw new ForbiddenException('Ação não permitida');

    classroom.isArchived = false;
    return this.classroomsRepository.save(classroom);
  }

  async remove(id: string, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');
    if (classroom.owner.id !== userId) {
      throw new ForbiddenException(
        'Apenas o professor (dono) pode excluir esta turma.',
      );
    }
    if (!classroom.isArchived) {
      throw new ForbiddenException(
        'A turma deve ser arquivada antes de ser excluída definitivamente.',
      );
    }

    return this.classroomsRepository.remove(classroom);
  }
}
