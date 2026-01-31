import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;

  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @Matches(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula' })
  @Matches(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula' })
  @Matches(/[0-9]/, { message: 'A senha deve conter pelo menos um número' })
  password: string;
}