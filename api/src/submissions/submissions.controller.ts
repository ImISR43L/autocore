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

interface RequestWithUser {
  user: {
    userId: number;
    email: string;
    role: string;
  };
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createSubmissionDto: CreateSubmissionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.submissionsService.create(createSubmissionDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats(@Request() req: RequestWithUser) {
    return this.submissionsService.getTeacherStats(req.user.userId);
  }

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
    @Request() req: RequestWithUser,
  ) {
    return this.submissionsService.grade(id, gradeDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('problem/:id')
  findAllByProblem(@Param('id') id: string) {
    return this.submissionsService.findAllByProblem(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
