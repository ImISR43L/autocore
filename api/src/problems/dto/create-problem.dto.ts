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

class ParameterDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['int', 'float', 'string', 'boolean', 'int[]', 'string[]'])
  type: string;
}

// --- NOVO DTO PARA QUESTÕES FILHAS ---
export class CreateQuestionDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() description: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Slug inválido' })
  slug: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDefinitionDto)
  parameters: ParameterDefinitionDto[];

  @IsString() returnType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseDto)
  testCases: CreateTestCaseDto[];
}
// -------------------------------------

export class CreateProblemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
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

  @IsInt()
  @Min(1)
  @IsOptional()
  timeLimit?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDefinitionDto)
  @IsOptional()
  parameters?: ParameterDefinitionDto[];

  @IsString()
  @IsOptional()
  returnType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseDto)
  @IsOptional()
  testCases?: CreateTestCaseDto[];

  // --- ARRAY DE QUESTÕES (OPCIONAL) ---
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsOptional()
  questions?: CreateQuestionDto[];
  // ------------------------------------
}
