import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus'; // Importante
import { HttpModule } from '@nestjs/axios'; // Necessário para ping check se usar
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    TypeOrmModule, // Importamos para checar a conexão do DB
  ],
  controllers: [HealthController],
})
export class HealthModule {}
