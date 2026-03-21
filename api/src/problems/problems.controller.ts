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
  Req,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DryRunDto } from './dto/dry-run.dto';

// Interface para tipagem do Request
interface RequestWithUser {
  user: {
    userId: string;
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
  @Get(':id/edit')
  findOneForEditing(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.problemsService.findOne(id, req.user.userId);
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

  @Post('dry-run')
  async dryRun(@Body() dryRunDto: DryRunDto) {
    return this.problemsService.dryRun(dryRunDto);
  }
}
