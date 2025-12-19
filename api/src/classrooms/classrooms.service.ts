import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateClassroomDto } from './dto/create-classroom.dto'; // <--- Importar DTO
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

  // CORREÇÃO: Assinatura atualizada para receber o DTO
  async create(createClassroomDto: CreateClassroomDto, ownerId: number) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Busca o dono pelo ID (mais seguro que cast manual)
    const owner = await this.usersRepository.findOne({
      where: { id: ownerId },
    });
    if (!owner) throw new NotFoundException('Usuário não encontrado');

    const classroom = this.classroomsRepository.create({
      ...createClassroomDto, // Espalha as propriedades do DTO (name)
      code,
      owner,
    });

    return this.classroomsRepository.save(classroom);
  }

  async join(code: string, userId: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { code },
      relations: ['owner', 'students'], // <--- Importante carregar 'owner' para a validação
    });

    if (!classroom) throw new NotFoundException('Código inválido');

    // 1. Validação: Dono não pode entrar na própria turma
    if (classroom.owner.id === userId) {
      throw new ForbiddenException(
        'Você é o professor desta turma e não pode entrar como aluno.',
      );
    }

    // 2. Validação: Evitar duplicidade
    const alreadyEnrolled = classroom.students.some((s) => s.id === userId);
    if (alreadyEnrolled) {
      throw new ConflictException('Você já está matriculado nesta turma.');
    }

    // Se passou, adiciona o aluno
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário inválido');

    classroom.students.push(user);
    return this.classroomsRepository.save(classroom);
  }

  async findMyClassrooms(userId: number) {
    // Busca turmas onde sou dono
    const teaching = await this.classroomsRepository.find({
      where: { owner: { id: userId } },
    });

    // Busca turmas onde sou aluno
    const enrolled = await this.classroomsRepository.find({
      where: { students: { id: userId } },
    });

    return { teaching, enrolled };
  }

  async findOne(id: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['owner', 'students', 'problems'],
    });
    if (!classroom) throw new NotFoundException('Turma não encontrada');
    return classroom;
  }

  async leave(id: number, userId: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['students'], // Precisamos carregar a lista para modificá-la
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    // Filtra a lista de estudantes removendo o usuário atual
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

    // O método remove do TypeORM lida com a tabela de junção (students) automaticamente.
    // Graças ao onDelete: 'CASCADE' na entidade Problem, os exercícios também somem.
    return this.classroomsRepository.remove(classroom);
  }
}
