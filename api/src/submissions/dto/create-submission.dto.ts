import { IsString, IsNumber, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateSubmissionDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsNumber()
  language_id: number;

  @IsOptional()
  @IsString()
  stdin?: string;
}
