import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  // 1. Criar Turma (O usuário vira "Dono/Professor" dela)
  async create(name: string, ownerId: number) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase(); // Gera código ex: 5A9F2B

    const classroom = this.classroomsRepository.create({
      name,
      code,
      owner: { id: ownerId } as User,
    });

    return this.classroomsRepository.save(classroom);
  }

  // 2. Entrar na Turma (O usuário vira "Aluno" dela)
  async join(code: string, userId: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { code },
      relations: ['students'],
    });

    if (!classroom)
      throw new NotFoundException('Turma não encontrada com este código');

    // Verifica se já não é o dono
    // (Opcional: impedir dono de ser aluno, ou permitir para testes)

    // Adiciona o aluno
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    classroom.students.push(user);

    return this.classroomsRepository.save(classroom);
  }

  // 3. Listar Minhas Turmas (Para o Dashboard)
  async findMyClassrooms(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ownedClassrooms', 'joinedClassrooms'],
    });

    return {
      teaching: user.ownedClassrooms, // Onde sou Professor
      enrolled: user.joinedClassrooms, // Onde sou Aluno
    };
  }

  // Auxiliar para validar permissão
  async isOwner(classroomId: number, userId: number): Promise<boolean> {
    const classroom = await this.classroomsRepository.findOne({
      where: { id: classroomId },
      relations: ['owner'],
    });
    return classroom && classroom.owner.id === userId;
  }
}
