import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private announcementsRepository: Repository<Announcement>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
  ) {}

  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  async create(
    createAnnouncementDto: any,
    files: Array<Express.Multer.File>,
    authorId: string,
  ) {
    const classroomCheck = await this.classroomsRepository.findOne({
      where: { id: createAnnouncementDto.classroomId },
    });

    if (!classroomCheck) {
      throw new NotFoundException('Turma não encontrada');
    }

    if (classroomCheck.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    const attachments: any[] = [];

    if (
      createAnnouncementDto.manualLinks &&
      createAnnouncementDto.manualLinks !== '[]'
    ) {
      try {
        const manualUrls: string[] = JSON.parse(
          createAnnouncementDto.manualLinks,
        );
        const linksText = manualUrls.join(' ');
        const extractedLinks = await this.extractLinkMetadata(linksText);

        const formattedLinks = extractedLinks.map((link) => ({
          type: 'link',
          ...link,
        }));

        attachments.push(...formattedLinks);
      } catch (error) {
        throw new InternalServerErrorException(
          'Falha ao processar os links fornecidos.',
        );
      }
    }

    if (files && files.length > 0) {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `announcements/${createAnnouncementDto.classroomId}/${fileName}`;

        // Substituir 'classroom-files' pelo nome exato do seu bucket no Supabase
        const { error } = await this.supabase.storage
          .from('classroom-files')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (error) {
          throw new InternalServerErrorException(
            `Falha no upload do arquivo ${file.originalname}: ${error.message}`,
          );
        }

        const { data: publicUrlData } = this.supabase.storage
          .from('classroom-files')
          .getPublicUrl(filePath);

        return {
          type: 'file',
          url: publicUrlData.publicUrl,
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      attachments.push(...uploadedFiles);
    }

    const announcement = this.announcementsRepository.create({
      content: createAnnouncementDto.content,
      classroom: { id: createAnnouncementDto.classroomId },
      author: { id: authorId },
      attachments: attachments,
    });

    return await this.announcementsRepository.save(announcement);
  }

  async remove(id: string, userId: string) {
    const announcement = await this.announcementsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!announcement) throw new NotFoundException('Aviso não encontrado');

    if (announcement.classroom?.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

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
