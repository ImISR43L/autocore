import { Controller, Post, Get, Body } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  create(@Body('code') code: string) {
    return this.submissionsService.executeCode(code);
  }

  @Get() // Novo endpoint GET /submissions
  findAll() {
    return this.submissionsService.findAll();
  }
}
