import { Controller, Post, Get, Body } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  // Recebe o corpo completo (body)
  create(@Body() body: { code: string; language_id: number; stdin: string }) {
    return this.submissionsService.executeCode(body);
  }

  @Get()
  findAll() {
    return this.submissionsService.findAll();
  }
}
