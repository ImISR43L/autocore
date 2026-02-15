import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10)) // Limite de 10 arquivos simultâneos
  create(
    @Body() body: any,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Request() req,
  ) {
    // Como os dados chegam via FormData, body.classroomId será uma string
    return this.announcementsService.create(body, files || [], req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.announcementsService.remove(id, req.user.userId);
  }
}
