import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param, // <--- ADICIONE ISSO
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ClassroomsService } from './classrooms.service';

@UseGuards(AuthGuard('jwt'))
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  create(@Body('name') name: string, @Request() req) {
    return this.classroomsService.create(name, req.user.userId);
  }

  @Post('join')
  join(@Body('code') code: string, @Request() req) {
    return this.classroomsService.join(code, req.user.userId);
  }

  @Get('my')
  findMy(@Request() req) {
    return this.classroomsService.findMyClassrooms(req.user.userId);
  }

  // --- ADICIONE ESTE ENDPOINT (NO FINAL DA CLASSE) ---
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classroomsService.findOne(+id);
  }
}
