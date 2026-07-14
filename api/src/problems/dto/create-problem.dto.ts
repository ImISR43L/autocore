import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsInt,
  IsISO8601,
  Min,
  IsUUID,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProblemType } from '../entities/problem.entity';
import { SubjectType } from '../../common/enums/subject-type.enum';

class SolutionFileDto {
  @IsString()
  name: string;

  @IsString()
  content: string;
}

export class ProblemFileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  content: string;
}

class ParameterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;
}

class TestCaseDto {
  @IsString()
  input: string;

  @IsString()
  expectedOutput: string;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}

export class CreateQuestionDto {
  // Opcional: presente quando a questão já existe (edição de uma prova).
  // Usado pelo service para casar com a questão-filha já persistida em vez
  // de sempre apagar tudo e recriar do zero — o que quebrava o histórico
  // de submissões dos alunos a cada edição. Ausente = questão nova.
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters?: ParameterDto[];

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  starterCode?: ProblemFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  solutionCode?: ProblemFileDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedLanguages?: string[];

  @IsOptional()
  @IsObject()
  validationConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  memoryLimit?: number;
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

  @IsOptional()
  @IsEnum(SubjectType)
  subject?: SubjectType;

  @IsString()
  @IsOptional()
  teacherNotes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedLanguages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsNotEmpty()
  @IsUUID()
  classroomId: string;

  @IsOptional()
  @IsEnum(ProblemType)
  type?: ProblemType;

  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @IsISO8601()
  deadline?: string | null;

  // --- Campos de execução (usados quando o problema é um EXERCISE avulso,
  // ou seja, NÃO possui `questions`). Para uma EXAM com questões, esses
  // dados vivem em cada CreateQuestionDto, e o service força estes campos
  // do pai a ficarem vazios/nulos — mas o DTO precisa aceitá-los, pois um
  // EXERCISE (Programação, Química, HTML ou SQL) não tem filhos e depende
  // exclusivamente destes campos na raiz.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterDto)
  parameters?: ParameterDto[];

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProblemFileDto)
  starterCode?: ProblemFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SolutionFileDto)
  solutionCode?: SolutionFileDto[];

  @IsOptional()
  @IsObject()
  validationConfig?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  timeLimit?: number;

  @IsOptional()
  @IsInt()
  memoryLimit?: number;

  // --- Campos exclusivos de SQL (subject: SQL). Mesmo recorte do
  // sqlSchema/sqlOrderSensitive adicionados à entidade Problem na Fase 1:
  // sqlSchema é o DDL de referência, sqlOrderSensitive controla se a
  // comparação do result set respeita a ordem das linhas. Ambos opcionais
  // no DTO porque as demais matérias não os enviam — quem exige
  // sqlSchema de fato é o SqlQueryGradingStrategy em tempo de submissão
  // (retorna 'Internal Error' se ausente), não a validação de criação
  // aqui.
  @IsOptional()
  @IsString()
  sqlSchema?: string;

  @IsOptional()
  @IsBoolean()
  sqlOrderSensitive?: boolean;

  // Gabarito de modelagem conceitual (subject: SQL_MODELING). Estrutura
  // livre (Record) no DTO de propósito — a Fase 2a não valida o shape do
  // ErModel no create, só persiste; validação estrutural fica pro
  // corretor automático quando ele existir (Fase 2b).
  @IsOptional()
  @IsObject()
  referenceModel?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
