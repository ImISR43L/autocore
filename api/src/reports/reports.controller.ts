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

  // Rota antiga (CSV) - Mantida funcionando
  @UseGuards(JwtAuthGuard)
  @Get('classroom/:id/csv')
  async exportCsv(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="relatorio_turma_${id}.csv"`,
    });
    // Nota: renomeamos o método no service para generateClassroomCSV
    return this.reportsService.generateClassroomCSV(id, req.user.userId);
  }

  // NOVA ROTA (Excel)
  @UseGuards(JwtAuthGuard)
  @Get('classroom/:id/xlsx')
  async exportExcel(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Header correto para Excel
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio_turma_${id}.xlsx"`,
    });

    return this.reportsService.generateClassroomExcel(id, req.user.userId);
  }
}
