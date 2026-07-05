import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamAccessToken } from './entities/exam-access-token.entity';
import { ExamAccessGrant } from './entities/exam-access-grant.entity';
import { Problem } from '../problems/entities/problem.entity';
import { ExamAccessService } from './exam-access.service';
import { ExamAccessController } from './exam-access.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

// Precisa ser importado em AppModule para os endpoints funcionarem.
@Module({
  imports: [
    TypeOrmModule.forFeature([ExamAccessToken, ExamAccessGrant, Problem]),
    UsersModule,
    AuthModule,
  ],
  controllers: [ExamAccessController],
  providers: [ExamAccessService],
  exports: [ExamAccessService],
})
export class ExamAccessModule {}
