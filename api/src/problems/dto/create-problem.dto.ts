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
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestCaseDto {
  @IsString()
  @IsNotEmpty()
  input: string;

  @IsString()
  @IsNotEmpty()
  expectedOutput: string;

  // --- CAMPO NOVO ---
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
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
  @Type(() => CreateTestCaseDto)
  testCases: CreateTestCaseDto[];
}
