import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
} from '@nestjs/common';
// O AuthGuard pode ser removido das importações se não for usado explicitamente
// import { AuthGuard } from '@nestjs/passport';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// --- CORREÇÃO: Mantido apenas o JwtAuthGuard ---
@UseGuards(JwtAuthGuard)
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  create(@Body() createClassroomDto: CreateClassroomDto, @Request() req) {
    return this.classroomsService.create(createClassroomDto, req.user.userId);
  }

  @Post('join')
  joinClassroom(@Body() body: { code: string }, @Request() req) {
    // Nota: O nome do método no service deve ser verificado (join ou joinClassroom)
    // Baseado no seu código anterior, parece ser joinClassroom
    return this.classroomsService.joinClassroom(body.code, req.user.userId);
  }

  @Get()
  findAll(@Request() req) {
    return this.classroomsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.classroomsService.findOne(+id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.classroomsService.remove(+id, req.user.userId);
  }
}
