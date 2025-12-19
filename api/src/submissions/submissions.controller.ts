import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
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
  @Get('problem/:id')
  findAllByProblem(@Param('id') id: string) {
    return this.submissionsService.findAllByProblem(id);
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
