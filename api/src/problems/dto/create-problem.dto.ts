import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestCaseDto {
  @IsString()
  @IsNotEmpty()
  input: string;

  @IsString()
  @IsNotEmpty()
  expectedOutput: string;

  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}

// Classe auxiliar para validar os parâmetros dentro do JSON
class ParameterDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['int', 'float', 'string', 'boolean', 'int[]', 'string[]'])
  type: string;
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
  // Regex opcional para forçar slug (letras minúsculas, números e hífens)
  // Se preferir livre, remova o @Matches.
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'O slug deve conter apenas letras minúsculas, números e hífens (ex: soma-dois-numeros)',
  })
  slug: string;

  @IsInt()
  @IsNotEmpty()
  classroomId: number;

  @IsEnum(['EXERCISE', 'EXAM'])
  type: 'EXERCISE' | 'EXAM';

  @IsInt()
  @Min(1)
  @IsOptional()
  maxAttempts?: number;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDefinitionDto)
  @IsOptional() // Opcional para manter compatibilidade
  parameters?: ParameterDefinitionDto[];

  @IsString()
  @IsOptional()
  returnType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseDto)
  testCases: CreateTestCaseDto[];

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;
}
