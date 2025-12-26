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
      relations: ['owner'], // Garante dados completos
    });

    // 2. Turmas que eu estudo
    const enrolled = await this.classroomsRepository.find({
      where: { students: { id: userId } },
      relations: ['owner'], // Importante para mostrar o nome do professor no card
    });

    // 3. RETORNAR UM ARRAY ÚNICO (FLAT LIST)
    // Adicionamos a propriedade virtual 'isOwner' para o front saber filtrar
    return [
      ...teaching.map((c) => ({ ...c, isOwner: true })),
      ...enrolled.map((c) => ({ ...c, isOwner: false })),
    ];
  }
  // ---------------------

  async findOne(id: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: [
        'owner',
        'students',
        'problems',
        'announcements',
        'announcements.author',
      ],
      order: {
        announcements: {
          createdAt: 'DESC',
        },
      } as any,
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada');

    if (classroom.announcements) {
      classroom.announcements.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
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
