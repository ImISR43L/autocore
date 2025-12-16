import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { AuthGuard } from '@nestjs/passport';
// Removemos imports de Roles e UserRole

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @UseGuards(AuthGuard('jwt')) // Apenas Login necessário
  @Post()
  create(@Body() createProblemDto: CreateProblemDto, @Request() req) {
    return this.problemsService.create(createProblemDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.problemsService.findAll();
  }
}
