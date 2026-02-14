import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

// Define a estrutura do usuário injetado pelo JWT Strategy
interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@UseGuards(AuthGuard('jwt'))
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  create(
    @Body() createDto: CreateAnnouncementDto,
    @Request() req: RequestWithUser,
  ) {
    // Agora req.user.userId é tipado como number, satisfazendo o compilador
    return this.announcementsService.create(createDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.announcementsService.remove(id, req.user.userId);
  }
}
