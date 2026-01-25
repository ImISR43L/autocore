import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';
import { SubmissionsProcessor } from './submissions.processor';
import { SubmissionsGateway } from './submissions.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, Problem]),
    BullModule.registerQueue({
      name: 'submissions',
    }),
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, SubmissionsProcessor, SubmissionsGateway],
})
export class SubmissionsModule {}
