// api/src/submissions/submissions.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createSubmissionDto: CreateSubmissionDto, @Request() req) {
    return this.submissionsService.create(createSubmissionDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats(@Request() req) {
    return this.submissionsService.getTeacherStats(req.user.userId);
  }

  // --- NOVA ROTA: ESTATÍSTICAS DO PROBLEMA ---
  @UseGuards(JwtAuthGuard)
  @Get('stats/problem/:id')
  getProblemStats(@Param('id') id: string) {
    return this.submissionsService.getProblemStats(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/grade')
  grade(
    @Param('id') id: string,
    @Body() gradeDto: GradeSubmissionDto,
    @Request() req,
  ) {
    return this.submissionsService.grade(id, gradeDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('problem/:id')
  findAllByProblem(@Param('id') id: string) {
    return this.submissionsService.findAllByProblem(id);
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats/classroom/:id')
  getClassroomStats(@Param('id') id: string, @Request() req) {
    return this.submissionsService.getClassroomStats(+id, req.user.userId);
  }
}
