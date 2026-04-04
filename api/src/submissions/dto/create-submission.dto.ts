import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class FileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  content: string; // Pode ser vazio, mas deve ser string
}

export class CreateSubmissionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[]; // ALTERAÇÃO: Recebe lista de arquivos

  @IsOptional()
  @IsInt()
  language_id?: number;

  @IsUUID()
  @IsNotEmpty()
  problem_id: string;
}
