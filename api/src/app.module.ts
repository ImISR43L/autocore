import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsModule } from './submissions/submissions.module';
import { Submission } from './submissions/entities/submission.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      // CORREÇÃO CRÍTICA AQUI:
      // Se estiver no Docker, usa a variável DB_HOST ('db').
      // Se não, usa 'localhost'.
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: process.env.DB_USER || 'autocore_user',
      password: process.env.DB_PASS || 'autocore_pass',
      database: process.env.DB_NAME || 'autocore_db',
      entities: [Submission],
      synchronize: true,
    }),
    SubmissionsModule,
  ],
})
export class AppModule {}
