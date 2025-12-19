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
import { UpdateProblemDto } from './dto/update-problem.dto'; // <--- Importe
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.problemsService.findOne(id);
  }

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
  remove(@Param('id') id: string, @Request() req) {
    return this.problemsService.remove(id, req.user.userId);
  }
}
