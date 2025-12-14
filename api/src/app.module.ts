import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // [Novo]
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsModule } from './submissions/submissions.module';
import { Submission } from './submissions/entities/submission.entity';

@Module({
  imports: [
    // [Novo] Carrega as variáveis do .env globalmente
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
      entities: [Submission],
      synchronize: true,
    }),
    SubmissionsModule,
  ],
})
export class AppModule {}
