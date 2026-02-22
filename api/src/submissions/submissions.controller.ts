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
import { Throttle } from '@nestjs/throttler';

interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Body() createSubmissionDto: CreateSubmissionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.submissionsService.create(createSubmissionDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats(@Request() req: RequestWithUser) {
    return this.submissionsService.getTeacherStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats/classroom/:id')
  getClassroomStats(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.submissionsService.getClassroomStats(id, req.user.userId);
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
  @Patch(':id/deliver')
  markAsDelivery(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.submissionsService.markAsDelivery(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('problem/:id')
  findAllByProblem(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.submissionsService.findAllByProblem(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
