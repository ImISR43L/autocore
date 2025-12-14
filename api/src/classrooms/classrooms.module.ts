import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomsService } from './classrooms.service';
import { ClassroomsController } from './classrooms.controller';
import { Classroom } from './entities/classroom.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Classroom, User])],
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService], // Exportamos caso outro módulo precise validar turmas
})
export class ClassroomsModule {}
