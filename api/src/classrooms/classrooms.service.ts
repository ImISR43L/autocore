import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(name: string, ownerId: number) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Precisamos do objeto User completo ou pelo menos o ID
    const classroom = this.classroomsRepository.create({
      name,
      code,
      owner: { id: ownerId } as User,
    });

    return this.classroomsRepository.save(classroom);
  }

  async join(code: string, userId: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { code },
      relations: ['students'],
    });

    if (!classroom)
      throw new NotFoundException('Turma não encontrada com este código');

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    // CORREÇÃO 1: Verificar se o usuário existe antes de usar
    if (!user) throw new NotFoundException('Usuário não encontrado');

    // Inicializa o array se estiver vazio (por segurança)
    if (!classroom.students) classroom.students = [];

    // Evita duplicatas (opcional, mas recomendado)
    const isAlreadyIn = classroom.students.some((s) => s.id === user.id);
    if (!isAlreadyIn) {
      classroom.students.push(user);
    }

    return this.classroomsRepository.save(classroom);
  }

  async findMyClassrooms(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['ownedClassrooms', 'joinedClassrooms'],
    });

    if (!user) return { teaching: [], enrolled: [] };

    return {
      teaching: user.ownedClassrooms,
      enrolled: user.joinedClassrooms,
    };
  }

  async findOne(id: number) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id },
      relations: ['problems', 'owner'], // Carrega os problemas e o dono para a IDE
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    return classroom;
  }

  async isOwner(classroomId: number, userId: number): Promise<boolean> {
    const classroom = await this.classroomsRepository.findOne({
      where: { id: classroomId },
      relations: ['owner'],
    });

    // CORREÇÃO 2: Garantir retorno booleano estrito (!! converte para true/false)
    return !!(classroom && classroom.owner && classroom.owner.id === userId);
  }
}
