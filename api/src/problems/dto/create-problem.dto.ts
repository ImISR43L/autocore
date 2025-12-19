import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsISO8601,
} from 'class-validator';
import { ProblemType } from '../entities/problem.entity';

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

  @IsNotEmpty()
  classroomId: number;

  // --- NOVAS VALIDAÇÕES ---
  @IsEnum(ProblemType)
  @IsOptional()
  type?: ProblemType;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxAttempts?: number;
  // -----------------------

  @IsOptional()
  testCases?: any[];

  @IsISO8601()
  @IsOptional()
  deadline?: string;
}
