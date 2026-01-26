import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('classroom/:id/csv')
  async exportCsv(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Definimos headers manuais para garantir que o navegador trate como download
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="relatorio_turma_${id}.csv"`,
    });

    return this.reportsService.generateClassroomReport(+id, req.user.userId);
  }
}
