import { PartialType } from '@nestjs/mapped-types';
import { CreateProblemDto, CreateQuestionDto } from './create-problem.dto';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProblemDto extends PartialType(CreateProblemDto) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsOptional()
  questions?: CreateQuestionDto[];
}
