import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity'; // <--- Importe a entidade
import { ExamAccessGrant } from '../exam-access/entities/exam-access-grant.entity';

@Module({
  imports: [
    // Adicione Classroom aqui para que o Repository seja criado neste escopo
    // ExamAccessGrant: usado por ProblemsService.hasActiveExamGrant() para
    // checar acesso via token de prova temporário (ver exam-access module).
    TypeOrmModule.forFeature([Problem, TestCase, Classroom, ExamAccessGrant]),
  ],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
