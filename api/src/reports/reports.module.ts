import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { Submission } from '../submissions/entities/submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Classroom, Submission])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
