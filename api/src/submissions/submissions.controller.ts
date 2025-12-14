// api/src/submissions/submissions.controller.ts
import { Controller, Post, Get, Body } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  create(@Body() body: any) {
    return this.submissionsService.executeCode(body);
  }

  @Post('seed') // Endpoint temporário para criar o problema no banco
  seed() {
    return this.submissionsService.seedProblem();
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
