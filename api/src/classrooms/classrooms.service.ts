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

@Injectable()
export class ClassroomsService {
  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createClassroomDto: CreateClassroomDto, ownerId: number) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

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

    // CORREÇÃO: Adicionamos manualmente a propriedade isOwner: true
    // para que o frontend reconheça que quem criou é o professor.
    return {
      ...savedClassroom,
      isOwner: true,
    };
  }

  // --- RENOMEADO DE join PARA joinClassroom ---
  async joinClassroom(code: string, userId: number) {
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
    return this.classroomsRepository.save(classroom);
  }

  // --- RENOMEADO DE findMyClassrooms PARA findAll ---
  async findAll(userId: number) {
    const teaching = await this.classroomsRepository.find({
      where: { owner: { id: userId } },
      relations: ['owner', 'problems'],
    });

    const enrolled = await this.classroomsRepository.find({
      where: { students: { id: userId } },
      relations: ['owner', 'problems'],
    });

    return [
      ...teaching.map((c) => ({ ...c, isOwner: true })),
      ...enrolled.map((c) => ({ ...c, isOwner: false })),
    ];
  }

  async findOne(id: number, userId?: number) {
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

    // LÓGICA DE FILTRAGEM E PROTEÇÃO
    if (userId && classroom.owner.id !== userId) {
      const now = new Date();

      if (classroom.problems) {
        classroom.problems = classroom.problems.filter((p) => {
          if (p.parent) return false;
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

  async leave(id: number, userId: number) {
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

  async remove(id: number, userId: number) {
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

    return this.classroomsRepository.remove(classroom);
  }
}
