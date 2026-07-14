import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { getSecret } from '../../common/utils/secrets.util';

export type SqlExecutionStatus =
  | 'Accepted'
  | 'Wrong Answer'
  | 'Runtime Error'
  | 'Compilation Error'
  | 'Time Limit Exceeded';

export interface SqlExecutionResult {
  status: SqlExecutionStatus;
  rows?: Record<string, any>[];
  error?: string;
}

// Timeout aplicado no lado do Postgres (statement_timeout), não só no
// client Node — uma query travada continua consumindo CPU do servidor
// mesmo que o lado da aplicação desista de esperar.
const STATEMENT_TIMEOUT_MS = 5_000;

// Teto de linhas retornadas, para uma query tipo `CROSS JOIN` acidental
// não estourar memória do processo Node ao serializar o resultado.
const MAX_ROWS = 1_000;

// Whitelist, não blacklist: só aceitamos leitura. É mais seguro bloquear
// "tudo que não é SELECT/WITH" do que tentar enumerar tudo que é perigoso
// (DROP, TRUNCATE, ALTER, funções que escrevem em disco, etc.) — a lista
// de coisas perigosas em SQL é longa e cresce com cada versão do Postgres.
const READ_ONLY_QUERY_PATTERN = /^(SELECT|WITH)\b/i;

@Injectable()
export class SqlExecutorService implements OnModuleDestroy {
  private readonly logger = new Logger(SqlExecutorService.name);
  private readonly pool: Pool;

  constructor() {
    // Pool separado do TypeORM principal da aplicação — aponta para o
    // banco de sandbox, conectado com uma role de baixo privilégio
    // (CREATE/DROP SCHEMA permitido; sem acesso a outros bancos/schemas
    // fora do que ela mesma cria). Configurar essa role no Postgres é a
    // barreira de segurança real; o parsing abaixo é só a primeira linha
    // de defesa, mais barata e mais cedo.
    this.pool = new Pool({
      host: process.env.SQL_SANDBOX_HOST || 'sql-sandbox-db',
      port: parseInt(process.env.SQL_SANDBOX_PORT || '5432', 10),
      database: process.env.SQL_SANDBOX_DATABASE || 'grading_sandbox',
      user: process.env.SQL_SANDBOX_USER || 'sql_sandbox',
      password: getSecret(
        'SQL_SANDBOX_ROLE_PASSWORD',
        'sql_sandbox_role_password',
      ),
      max: parseInt(process.env.SQL_SANDBOX_POOL_SIZE || '10', 10),
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  /**
   * Executa a query do aluno em um schema Postgres efêmero, criado e
   * destruído para esta chamada. `setupDdl` monta as tabelas de
   * referência (Problem.sqlSchema); `seedDml`, se houver, popula dados
   * específicos do test case (TestCase.input).
   */
  async runQuery(
    setupDdl: string,
    seedDml: string | null,
    studentQuery: string,
  ): Promise<SqlExecutionResult> {
    const validation = this.validateQueryShape(studentQuery);
    if (validation) return validation;

    const schemaName = `grading_${randomUUID().replace(/-/g, '_')}`;
    const client = await this.pool.connect();

    try {
      await client.query(`CREATE SCHEMA "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

      await client.query(setupDdl);
      if (seedDml && seedDml.trim()) {
        await client.query(seedDml);
      }

      const normalized = studentQuery.trim().replace(/;\s*$/, '');
      const result = await client.query(`${normalized} LIMIT ${MAX_ROWS}`);

      return { status: 'Accepted', rows: result.rows };
    } catch (err: any) {
      return this.mapError(err);
    } finally {
      await this.cleanupSchema(client, schemaName);
    }
  }

  /**
   * Rejeita de cara qualquer coisa que não seja uma única instrução de
   * leitura. Duas checagens:
   *   1) Múltiplas instruções separadas por `;` (stacked queries) — mesmo
   *      que a primeira seja um SELECT inofensivo, a segunda poderia ser
   *      qualquer coisa.
   *   2) A instrução não começa com SELECT/WITH.
   */
  private validateQueryShape(studentQuery: string): SqlExecutionResult | null {
    const trimmed = (studentQuery || '').trim();

    if (!trimmed) {
      return {
        status: 'Compilation Error',
        error: 'Nenhuma consulta SQL enviada.',
      };
    }

    const statements = trimmed
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    if (statements.length > 1) {
      return {
        status: 'Compilation Error',
        error: 'Apenas uma instrução SQL é permitida por submissão.',
      };
    }

    if (!READ_ONLY_QUERY_PATTERN.test(trimmed)) {
      return {
        status: 'Compilation Error',
        error:
          'Este exercício aceita apenas consultas de leitura (SELECT/WITH).',
      };
    }

    return null;
  }

  private mapError(err: any): SqlExecutionResult {
    const message: string = err?.message || 'Erro desconhecido.';

    // 57014 = query_canceled, disparado pelo statement_timeout do Postgres.
    if (err?.code === '57014') {
      return {
        status: 'Time Limit Exceeded',
        error: 'A consulta demorou demais para executar.',
      };
    }

    // Classe 42 no Postgres = erros de sintaxe ou de acesso ao schema
    // (coluna/tabela inexistente, tipo incompatível). Mapeia melhor para
    // "Compilation Error" — o problema está na query em si, não em algo
    // que rodou e falhou durante a execução.
    if (typeof err?.code === 'string' && err.code.startsWith('42')) {
      return { status: 'Compilation Error', error: message };
    }

    return { status: 'Runtime Error', error: message };
  }

  private async cleanupSchema(
    client: PoolClient,
    schemaName: string,
  ): Promise<void> {
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } catch (dropErr) {
      this.logger.warn(
        `Falha ao limpar schema ${schemaName} (não crítico):`,
        dropErr,
      );
    } finally {
      client.release();
    }
  }
}
