import { Body, Controller, Post, UseGuards } from '@nestjs/common';
// ASSUNÇÃO: não tenho visibilidade do guard HTTP real do projeto — só vi
// WsJwtGuard (websocket) em submissions.gateway.ts. Ajuste o import/nome
// abaixo para o guard que SubmissionsController/ProblemsController já
// usam hoje (é só isso que muda; o resto do controller não depende dele).
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SqlExecutorService } from './sql/sql-executor.service';
import { DryRunSqlDto } from './dto/dry-run-sql.dto';

/**
 * Endpoint de apoio ao professor durante a criação de exercícios de SQL:
 * roda a "consulta de gabarito" contra o sqlSchema + seedDml informados,
 * usando o MESMO SqlExecutorService (mesmo sandbox, mesmo timeout, mesma
 * whitelist de SELECT/WITH) que corrige as submissões dos alunos —
 * garante que o gabarito e a correção real nunca divirjam de
 * comportamento.
 *
 * Não persiste nada: não grava Problem nem TestCase. O frontend usa a
 * resposta só para preencher `expectedOutput` no formulário.
 *
 * Fica em SubmissionsModule (não em ProblemsModule) porque é onde o
 * SqlExecutorService já está registrado como provider — reaproveita a
 * mesma instância/pool de conexão do sandbox em vez de duplicar.
 */
@Controller('problems')
@UseGuards(JwtAuthGuard)
export class SqlDryRunController {
  constructor(private readonly sqlExecutor: SqlExecutorService) {}

  @Post('dry-run-sql')
  async dryRunSql(@Body() dto: DryRunSqlDto) {
    const result = await this.sqlExecutor.runQuery(
      dto.sqlSchema,
      dto.seedDml ?? null,
      dto.referenceQuery,
    );

    if (result.status !== 'Accepted') {
      return {
        success: false,
        status: result.status,
        error: result.error ?? 'Erro desconhecido ao rodar a consulta.',
      };
    }

    return { success: true, rows: result.rows ?? [] };
  }
}
