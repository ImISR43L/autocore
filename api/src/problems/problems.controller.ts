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
import { DryRunDto } from './dto/dry-run.dto';
import { DuplicateProblemDto } from './dto/duplicate-problem.dto';

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
    @Request() req: RequestWithUser,
  ) {
    return this.problemsService.create(createProblemDto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.problemsService.findAll(req.user.userId);
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
  @Patch(':id/end')
  endExam(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.problemsService.endExam(id, req.user.userId);
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

  @UseGuards(JwtAuthGuard)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateProblemDto,
    @Request() req: RequestWithUser,
  ) {
    return this.problemsService.duplicate(
      id,
      dto.targetClassroomId,
      req.user.userId,
      dto.includeTeacherNotes,
    );
  }

  @Post('dry-run')
  async dryRun(@Body() dryRunDto: DryRunDto) {
    return this.problemsService.dryRun(dryRunDto);
  }
}
