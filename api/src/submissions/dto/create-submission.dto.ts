import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class FileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  content: string; // Pode ser vazio, mas deve ser string
}

class ErModelAttributeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  isPK: boolean;

  @IsBoolean()
  isFK: boolean;

  @IsOptional()
  @IsString()
  type?: string;
}

class ErModelEntityDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErModelAttributeDto)
  attributes: ErModelAttributeDto[];
}

class ErModelRelationshipDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsIn(['1:1', '1:N', 'N:M'])
  cardinality: '1:1' | '1:N' | 'N:M';

  @IsOptional()
  @IsString()
  name?: string;
}

class ErModelDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErModelEntityDto)
  entities: ErModelEntityDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErModelRelationshipDto)
  relationships: ErModelRelationshipDto[];
}

export class CreateSubmissionDto {
  // Opcional a partir da Fase 2: submissões de SQL_MODELING enviam
  // `modelData`, não `files`. A obrigatoriedade real de um dos dois
  // dado o subject do problema é responsabilidade da GradingStrategy
  // correspondente (ex: SqlQueryGradingStrategy já rejeita query vazia),
  // não deste DTO — mesmo padrão que outros campos opcionais aqui.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files?: FileDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ErModelDto)
  modelData?: ErModelDto;

  @IsOptional()
  @IsInt()
  language_id?: number;

  @IsUUID()
  @IsNotEmpty()
  problem_id: string;

  @IsOptional()
  @IsArray()
  activityLogs?: Array<{
    action: 'COPY' | 'PASTE' | 'BLUR' | 'FOCUS';
    timestamp: string;
    details?: string;
  }>;
}
