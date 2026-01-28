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
import { UpdateProblemDto } from './dto/update-problem.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Interface para tipagem do Request
interface RequestWithUser {
  user: {
    userId: number;
    email: string;
    role: string;
  };
}

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() createProblemDto: CreateProblemDto,
    @Request() req: RequestWithUser, // Mantivemos o req, mas não usamos o userId por enquanto
  ) {
    // CORREÇÃO: Removido o segundo argumento (req.user.userId)
    // pois o método 'create' no service atualmente aceita apenas o DTO.
    return this.problemsService.create(createProblemDto);
  }

  @Get()
  findAll() {
    return this.problemsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.problemsService.findOne(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/start')
  startExam(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.problemsService.startExam(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProblemDto: UpdateProblemDto,
    @Request() req: RequestWithUser,
  ) {
    return this.problemsService.update(id, updateProblemDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.problemsService.remove(id, req.user.userId);
  }
}
