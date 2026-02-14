import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private announcementsRepository: Repository<Announcement>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  async create(createDto: CreateAnnouncementDto, userId: string) {
    const classroom = await this.classroomsRepository.findOne({
      where: { id: createDto.classroomId },
      relations: ['owner'],
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');

    if (classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o professor pode postar avisos.');
    }

    const announcement = this.announcementsRepository.create({
      content: createDto.content,
      classroom,
      author: { id: userId } as User,
    });

    return this.announcementsRepository.save(announcement);
  }

  async remove(id: string, userId: string) {
    const announcement = await this.announcementsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!announcement) throw new NotFoundException('Aviso não encontrado');

    if (announcement.classroom.owner.id !== userId) {
      throw new ForbiddenException('Apenas o professor pode apagar avisos.');
    }

    return this.announcementsRepository.remove(announcement);
  }
}
