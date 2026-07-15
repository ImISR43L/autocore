import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class DuplicateProblemDto {
  @IsUUID()
  @IsNotEmpty()
  targetClassroomId: string;

  // Opt-in, default false: teacherNotes é anotação privada do professor
  // de origem, não conteúdo pedagógico — não copiar por padrão evita
  // vazar observações pessoais ("aluno X sempre erra isso", "rever
  // enunciado") pra outra turma sem intenção explícita.
  @IsOptional()
  @IsBoolean()
  includeTeacherNotes?: boolean;
}
