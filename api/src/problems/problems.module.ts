import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { Problem } from '../submissions/entities/problem.entity';
import { TestCase } from '../submissions/entities/test-case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Problem, TestCase])],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
