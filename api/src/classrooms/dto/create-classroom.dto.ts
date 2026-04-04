import { IsNotEmpty, IsString, MinLength, IsEnum } from 'class-validator';
import { SubjectType } from '../entities/classroom.entity';

export class CreateClassroomDto {
  @IsString({ message: 'O nome da turma deve ser uma string.' })
  @IsNotEmpty({ message: 'O nome da turma não pode estar vazio.' })
  @MinLength(3, {
    message: 'O nome da turma deve ter pelo menos 3 caracteres.',
  })
  name: string;

  @IsNotEmpty({ message: 'A disciplina da turma é obrigatória.' })
  @IsEnum(SubjectType, {
    message:
      'A disciplina escolhida é inválida. Valores aceitos: PROGRAMMING ou CHEMISTRY.',
  })
  subject: SubjectType;
}
