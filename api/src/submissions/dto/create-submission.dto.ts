import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsInt()
  @IsNotEmpty()
  language_id: number;

  @IsString()
  @IsNotEmpty()
  problem_id: string;
}
