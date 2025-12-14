import { Controller, Post, Get, Body } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto'; // [Novo]

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  // [Alterado] Usa o DTO real em vez de tipagem manual
  create(@Body() createSubmissionDto: CreateSubmissionDto) {
    return this.submissionsService.executeCode(createSubmissionDto);
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
