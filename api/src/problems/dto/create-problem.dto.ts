import { IsString, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class TestCaseDto {
  @IsNotEmpty()
  @IsString()
  input: string;

  // Atenção: O Frontend deve enviar 'expectedOutput' (camelCase) ou você deve ajustar aqui para match
  // Como sua entidade usa expectedOutput, recomendo padronizar tudo para camelCase
  @IsNotEmpty()
  @IsString()
  expectedOutput: string;
}

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  slug: string; // <--- ADICIONE ISTO

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];

  @IsNotEmpty()
  classroomId: number;
}
