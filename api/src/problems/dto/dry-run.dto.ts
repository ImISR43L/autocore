import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsOptional,
  IsBoolean, // <--- Importar
} from 'class-validator';
import { Type } from 'class-transformer';

class FileEntryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  content: string;
}

class TestCaseDto {
  @IsString()
  input: string;

  @IsString()
  expectedOutput: string;

  // --- CORREÇÃO: Adicionar isHidden ---
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

// Classe auxiliar para validar os parâmetros
class ParameterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

export class DryRunDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileEntryDto)
  starterCode: FileEntryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases: TestCaseDto[];

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters: ParameterDto[];

  @IsString()
  @IsOptional()
  returnType?: string;
}
