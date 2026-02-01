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
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Interface para tipar o Request autenticado
interface RequestWithUser {
  user: {
    userId: number;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Post()
  create(
    @Body() createClassroomDto: CreateClassroomDto,
    @Request() req: RequestWithUser,
  ) {
    return this.classroomsService.create(createClassroomDto, req.user.userId);
  }

  @Post('join')
  joinClassroom(
    @Body() body: { code: string },
    @Request() req: RequestWithUser,
  ) {
    return this.classroomsService.joinClassroom(body.code, req.user.userId);
  }

  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.classroomsService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    // Recebe string
    return this.classroomsService.findOne(id, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.classroomsService.remove(id, req.user.userId);
  }

  @Delete(':id/leave')
  leave(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.classroomsService.leave(id, req.user.userId);
  }
}
