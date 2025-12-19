import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SubmissionsModule } from './submissions/submissions.module';
import { ProblemsModule } from './problems/problems.module'; // [Novo]
import { AuthModule } from './auth/auth.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { AnnouncementsModule } from './announcements/announcements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432), // Boa prática converter para Int
      username: process.env.DB_USERNAME || 'autocore_user', // CORRIGIDO: de DB_USER para DB_USERNAME
      password: process.env.DB_PASSWORD || 'autocore_password', // CORRIGIDO: de DB_PASS para DB_PASSWORD e atualizado o fallback
      database: process.env.DB_DATABASE || 'autocore_db', // CORRIGIDO: de DB_NAME para DB_DATABASE (para manter padrão)
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    ClassroomsModule,
    SubmissionsModule,
    ProblemsModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
