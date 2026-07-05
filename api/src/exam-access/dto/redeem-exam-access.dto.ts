import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class RedeemExamAccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  // Opcional: se quem está resgatando já é um usuário real logado (não uma
  // sessão anônima), não faz sentido nem pedir e-mail de novo.
  @IsOptional()
  @IsEmail()
  email?: string;
}
