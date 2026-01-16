// api/src/classrooms/classrooms.service.ts
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

    return this.classroomsRepository.save(classroom);
  }

  async join(code: string, userId: number) {
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

  // --- CORREÇÃO AQUI ---
  async findMyClassrooms(userId: number) {
    // 1. Turmas que eu ensino
    const teaching = await this.classroomsRepository.find({
      where: { owner: { id: userId } },
      relations: ['owner', 'problems'],
    });

    const enrolled = await this.classroomsRepository.find({
      where: { students: { id: userId } },
      relations: ['owner', 'problems'],
    });

    // 3. RETORNAR UM ARRAY ÚNICO (FLAT LIST)
    // Adicionamos a propriedade virtual 'isOwner' para o front saber filtrar
    return [
      ...teaching.map((c) => ({ ...c, isOwner: true })),
      ...enrolled.map((c) => ({ ...c, isOwner: false })),
    ];
  }
  // ---------------------

  async findOne(id: number, userId: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: [
        'owner',
        'students',
        'problems',
        'problems.parent', // Garante que temos o parent para filtrar filhos do dropdown
        'announcements',
        'announcements.author',
      ],
      order: {
        createdAt: 'DESC',
        problems: { createdAt: 'DESC' },
        announcements: { createdAt: 'DESC' },
      },
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    // Verifica se usuário tem acesso (opcional, mas recomendado)
    const isStudent = classroom.students.some((s) => s.id === userId);
    const isOwner = classroom.owner.id === userId;
    if (!isStudent && !isOwner) throw new ForbiddenException('Acesso negado');

    // --- LÓGICA DE FILTRAGEM ---
    if (!isOwner) {
      const now = new Date();
      classroom.problems = classroom.problems.filter((p) => {
        // 1. Remove filhos (já feito no front, mas bom garantir no back também se desejar)
        // Mas aqui filtraremos principalmente por DATA.

        // Se tiver startDate definido e for no futuro, esconde.
        if (p.startDate && new Date(p.startDate) > now) {
          return false;
        }
        return true;
      });
    }
    // ---------------------------

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
