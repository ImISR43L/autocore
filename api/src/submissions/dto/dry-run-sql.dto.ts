import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DryRunSqlDto {
  @IsString()
  @IsNotEmpty()
  sqlSchema: string;

  @IsString()
  @IsOptional()
  seedDml?: string;

  @IsString()
  @IsNotEmpty()
  referenceQuery: string;
}
