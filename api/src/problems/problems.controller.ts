import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() createProblemDto: CreateProblemDto, @Request() req) {
    return this.problemsService.create(createProblemDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.problemsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.problemsService.findOne(id, req.user.userId);
  }

  // --- CORREÇÃO AQUI: Adicionado @UseGuards(JwtAuthGuard) ---
  @UseGuards(JwtAuthGuard)
  @Patch(':id/start')
  startExam(@Param('id') id: string, @Request() req) {
    return this.problemsService.startExam(id, req.user.userId);
  }
  // ----------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProblemDto: UpdateProblemDto,
    @Request() req,
  ) {
    return this.problemsService.update(id, updateProblemDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.problemsService.remove(id);
  }
}
