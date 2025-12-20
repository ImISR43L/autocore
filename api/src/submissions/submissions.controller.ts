import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GradeSubmissionDto } from './dto/grade-submission.dto';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createSubmissionDto: CreateSubmissionDto, @Request() req) {
    return this.submissionsService.create(createSubmissionDto, req.user.userId);
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
  @Patch(':id/grade')
  grade(
    @Param('id') id: string,
    @Body() gradeDto: GradeSubmissionDto,
    @Request() req,
  ) {
    return this.submissionsService.grade(id, gradeDto, req.user.userId);
  }
}
