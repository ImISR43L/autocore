import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GradeSubmissionDto {
  @IsNumber()
  @Min(0)
  @Max(100) // Assumindo nota de 0 a 100 (pode ajustar para 10 se preferir)
  @IsOptional()
  grade?: number;

  @IsString()
  @IsOptional()
  teacherComment?: string;
}
