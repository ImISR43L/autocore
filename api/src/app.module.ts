import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SubmissionsModule } from './submissions/submissions.module';
import { ProblemsModule } from './problems/problems.module'; // [Novo]
import { AuthModule } from './auth/auth.module';
import { ClassroomsModule } from './classrooms/classrooms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      username: process.env.DB_USER || 'autocore_user',
      password: process.env.DB_PASS || 'autocore_pass',
      database: process.env.DB_NAME || 'autocore_db',
      // Adicione User à lista de entidades
      autoLoadEntities: true,
      synchronize: true,
    }),
    AuthModule,
    ClassroomsModule,
    SubmissionsModule,
    ProblemsModule, // Adicione o novo módulo aqui
  ],
})
export class AppModule {}
