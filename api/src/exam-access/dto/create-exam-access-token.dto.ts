import { IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateExamAccessTokenDto {
  // Padrão: 24h. Teto de 30 dias pra evitar um professor gerar (por engano
  // ou não) um link que fica válido indefinidamente.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  expiresInHours?: number;
}
