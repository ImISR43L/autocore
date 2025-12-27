// api/src/classrooms/classrooms.controller.ts
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
import { AuthGuard } from '@nestjs/passport';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  create(@Body() createClassroomDto: CreateClassroomDto, @Request() req) {
    return this.classroomsService.create(createClassroomDto, req.user.userId);
  }

  @Post('join')
  join(@Body('code') code: string, @Request() req) {
    return this.classroomsService.join(code, req.user.userId);
  }

  // --- CORREÇÃO: Rota Raiz para o Dashboard ---
  @Get()
  findAll(@Request() req) {
    // Retorna todas as turmas (próprias e as que participa)
    return this.classroomsService.findMyClassrooms(req.user.userId);
  }
  // --------------------------------------------

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.classroomsService.findOne(+id, req.user?.userId);
  }

  @Delete(':id/leave')
  leave(@Param('id') id: string, @Request() req) {
    return this.classroomsService.leave(+id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.classroomsService.remove(+id, req.user.userId);
  }
}
