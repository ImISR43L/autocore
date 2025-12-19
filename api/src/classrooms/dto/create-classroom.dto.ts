import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateClassroomDto {
  @IsString({ message: 'O nome da turma deve ser uma string.' })
  @IsNotEmpty({ message: 'O nome da turma não pode estar vazio.' })
  @MinLength(3, {
    message: 'O nome da turma deve ter pelo menos 3 caracteres.',
  })
  name: string;
}
