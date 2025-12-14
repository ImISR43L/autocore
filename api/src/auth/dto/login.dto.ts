import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class AuthDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  // Opcional: só usado no Registro
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
