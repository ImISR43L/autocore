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
import axios from 'axios';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private announcementsRepository: Repository<Announcement>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  async create(createAnnouncementDto: any, authorId: string) {
    const links = await this.extractLinkMetadata(createAnnouncementDto.content);

    const announcement = this.announcementsRepository.create({
      ...createAnnouncementDto,
      classroom: { id: createAnnouncementDto.classroomId },
      author: { id: authorId },
      links,
      attachments: [],
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

  private async extractLinkMetadata(text: string): Promise<any[]> {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex) || [];
    const uniqueUrls = [...new Set(urls)];
    const links: any[] = [];

    for (const url of uniqueUrls) {
      try {
        const response = await axios.get(url, { timeout: 3000 });
        const html = response.data;

        const getMetaTag = (property: string) => {
          const regex = new RegExp(
            `<meta(?:[^>]+property="${property}"[^>]*content="([^"]*)"|[^>]+content="([^"]*)"[^>]*property="${property}")`,
            'i',
          );
          const match = html.match(regex);
          return match ? match[1] || match[2] : null;
        };

        const getTitleTag = () => {
          const match = html.match(/<title>([^<]*)<\/title>/i);
          return match ? match[1] : null;
        };

        const title = getMetaTag('og:title') || getTitleTag() || url;
        const description =
          getMetaTag('og:description') || getMetaTag('description') || '';
        const imageUrl = getMetaTag('og:image') || '';

        links.push({ url, title, description, imageUrl });
      } catch (error) {
        // Em caso de erro (CORS, Timeout), salva apenas a URL crua
        links.push({ url, title: url, description: '', imageUrl: '' });
      }
    }
    return links;
  }
}
