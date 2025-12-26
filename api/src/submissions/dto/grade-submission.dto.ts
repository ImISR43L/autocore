import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeSubmissionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  grade?: number;

  @IsString()
  @IsOptional()
  teacherComment?: string;
}
