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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard) // 1. Exige Login e Role
  @Roles(UserRole.PROFESSOR) // 2. Apenas Professor
  @Post()
  create(@Body() createProblemDto: CreateProblemDto, @Request() req) {
    // 3. Passa o ID do usuário logado (req.user)
    return this.problemsService.create(createProblemDto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.problemsService.findAll();
  }
}
