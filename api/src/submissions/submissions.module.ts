import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { SubmissionsProcessor } from './submissions.processor'; // <--- Importe
import { Problem } from '../problems/entities/problem.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Problem]),
    BullModule.registerQueue({
      name: 'submissions',
    }),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionsProcessor],
})
export class SubmissionsModule {}
