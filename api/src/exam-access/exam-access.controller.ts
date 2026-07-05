import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExamAccessService } from './exam-access.service';
import { CreateExamAccessTokenDto } from './dto/create-exam-access-token.dto';
import { RedeemExamAccessDto } from './dto/redeem-exam-access.dto';

interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller()
export class ExamAccessController {
  constructor(private readonly examAccessService: ExamAccessService) {}

  // --- Gestão (professor) ---

  @UseGuards(JwtAuthGuard)
  @Post('problems/:id/access-tokens')
  generate(
    @Param('id') problemId: string,
    @Body() dto: CreateExamAccessTokenDto,
    @Request() req: RequestWithUser,
  ) {
    return this.examAccessService.generate(problemId, req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('problems/:id/access-tokens')
  list(@Param('id') problemId: string, @Request() req: RequestWithUser) {
    return this.examAccessService.listForProblem(problemId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('access-tokens/:tokenId')
  revoke(@Param('tokenId') tokenId: string, @Request() req: RequestWithUser) {
    return this.examAccessService.revoke(tokenId, req.user.userId);
  }

  // --- Convidado ---

  // Público, sem guard: precisa renderizar a tela de "você foi convidado
  // para a prova X" antes de qualquer autenticação existir.
  @Get('exam-access/:token')
  getPublicInfo(@Param('token') token: string) {
    return this.examAccessService.getPublicInfo(token);
  }

  // Protegido: o front já precisa ter uma sessão Supabase (anônima recém
  // criada, ou uma sessão real já existente) antes de chamar isto.
  @UseGuards(JwtAuthGuard)
  @Post('exam-access/:token/redeem')
  redeem(
    @Param('token') token: string,
    @Body() dto: RedeemExamAccessDto,
    @Request() req: RequestWithUser,
  ) {
    return this.examAccessService.redeem(token, req.user.userId, dto);
  }
}
