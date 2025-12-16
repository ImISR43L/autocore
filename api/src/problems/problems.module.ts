import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity'; // <--- Importe a entidade

@Module({
  imports: [
    // Adicione Classroom aqui para que o Repository seja criado neste escopo
    TypeOrmModule.forFeature([Problem, TestCase, Classroom]),
  ],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
