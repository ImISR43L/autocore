import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * DataSource isolado para scripts de seed.
 *
 * Por quê: `run-seed.ts` / `run-seed-classroom.ts` usavam
 * `NestFactory.createApplicationContext(AppModule)`, que sobe TODOS os
 * módulos da aplicação — incluindo `CacheModule` (Redis) e
 * `ThrottlerModule`. O client Redis (`cache-manager-redis-store`) não
 * tem timeout/retry_strategy configurado, então se o Redis não estiver
 * acessível no ambiente onde o seed roda, o processo fica pendurado
 * pra sempre, sem erro — foi o que causou a demora infinita.
 *
 * Como os seeds só mexem com Postgres/TypeORM, não faz sentido pagar
 * esse custo (nem esse risco). Aqui conectamos direto, com as mesmas
 * envs que o AppModule usa.
 *
 * Como este script não passa pelo `main.ts`/`AppModule` da aplicação
 * (onde o `reflect-metadata` normalmente já é importado antes de tudo),
 * precisamos importar aqui manualmente — sem isso, o TypeORM não
 * consegue inferir os tipos das colunas a partir dos decorators
 * (`ColumnTypeUndefinedError`).
 *
 * Uso: import { getSeedDataSource } from './seed-data-source';
 */
export async function getSeedDataSource(): Promise<DataSource> {
  const required = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente faltando: ${missing.join(', ')}. ` +
        'Confirme que o .env está no diretório de onde o script é executado.',
    );
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '6543'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'postgres',
    // Duas pastas acima de src/submissions/seeds é src/ — mesmo padrão
    // de glob usado no app.module.ts.
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: true,
    ssl: {
      rejectUnauthorized: false,
    },
    extra: {
      max: 5,
      connectionTimeoutMillis: 5000,
    },
  });

  await dataSource.initialize();
  return dataSource;
}
