import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Interface para tipar o Request autenticado
interface RequestWithUser {
  user: {
    userId: string;
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

  @Get('archived')
  findArchived(@Request() req: RequestWithUser) {
    return this.classroomsService.findArchived(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.classroomsService.findOne(id, req.user.userId);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.classroomsService.archive(id, req.user.userId);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.classroomsService.restore(id, req.user.userId);
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
