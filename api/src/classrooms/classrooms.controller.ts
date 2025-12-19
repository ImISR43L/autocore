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
import { CreateClassroomDto } from './dto/create-classroom.dto'; // <--- Importar DTO

@UseGuards(AuthGuard('jwt'))
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  // CORREÇÃO: Usar o DTO em vez de extrair apenas o 'name'
  create(@Body() createClassroomDto: CreateClassroomDto, @Request() req) {
    return this.classroomsService.create(createClassroomDto, req.user.userId);
  }

  @Post('join')
  join(@Body('code') code: string, @Request() req) {
    return this.classroomsService.join(code, req.user.userId);
  }

  @Get('my')
  findMy(@Request() req) {
    return this.classroomsService.findMyClassrooms(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classroomsService.findOne(+id);
  }

  @Delete(':id/leave')
  leave(@Param('id') id: string, @Request() req) {
    return this.classroomsService.leave(+id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    // Passamos o ID do usuário para validar a posse
    return this.classroomsService.remove(+id, req.user.userId);
  }
}
