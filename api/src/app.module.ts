import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsModule } from './submissions/submissions.module';
import { Submission } from './submissions/entities/submission.entity';
// Importe as novas entidades
import { Problem } from './submissions/entities/problem.entity';
import { TestCase } from './submissions/entities/test-case.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: process.env.DB_USER || 'autocore_user',
      password: process.env.DB_PASS || 'autocore_pass',
      database: process.env.DB_NAME || 'autocore_db',
      // CORREÇÃO: Adicione Problem e TestCase aqui
      entities: [Submission, Problem, TestCase],
      synchronize: true,
    }),
    SubmissionsModule,
  ],
})
export class AppModule {}
