import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  IsISO8601,
  Min,
  IsNumber,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemType } from '../entities/problem.entity';

// 1. Nova estrutura para arquivos (substitui o antigo StarterCodeDto)
export class ProblemFileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  content: string;
}

class ParameterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

class TestCaseDto {
  @IsString()
  input: string;

  @IsString()
  expectedOutput: string;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

// DTO para Sub-questões (usado dentro de uma Prova)
export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters?: ParameterDto[];

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];

  // Atualizado para usar ProblemFileDto
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  starterCode?: ProblemFileDto[];

  // Atualizado para usar ProblemFileDto
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  solutionCode?: ProblemFileDto[];
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
  slug: string;

  @IsEnum(['EASY', 'MEDIUM', 'HARD'])
  @IsOptional()
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';

  @IsString()
  @IsOptional()
  teacherNotes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedLanguages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  // 2. Mudança: Aceitar UUID
  @IsNotEmpty()
  @IsUUID()
  classroomId: string;

  // 3. Mudança: Usar ProblemFileDto
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  starterCode?: ProblemFileDto[];

  // 3. Mudança: Usar ProblemFileDto
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  solutionCode?: ProblemFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];

  @IsOptional()
  @IsEnum(ProblemType)
  type?: ProblemType;

  // 4. Mudança: Permitir 0 (infinito)
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  memoryLimit?: number;

  // 5. Mudança: Validação de Data ISO8601 (aceita null se sanitizado)
  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  deadline?: string | null;

  @IsOptional()
  @IsArray()
  parameters?: ParameterDto[];

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
