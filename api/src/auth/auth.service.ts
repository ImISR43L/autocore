import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { AuthDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: AuthDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const payload = { email: user.email, sub: user.id, userId: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email },
    };
  }

  async register(loginDto: AuthDto) {
    const hashedPassword = await bcrypt.hash(loginDto.password, 10);

    try {
      const user = this.usersRepository.create({
        email: loginDto.email,
        password: hashedPassword,
      });

      const savedUser = await this.usersRepository.save(user);

      // Retorna o token imediatamente após registro para login automático
      const payload = {
        email: savedUser.email,
        sub: savedUser.id,
        userId: savedUser.id,
      };
      return {
        access_token: this.jwtService.sign(payload),
        user: { id: savedUser.id, email: savedUser.email },
      };
    } catch (error: any) {
      // Código de erro do Postgres para violação de chave única
      if (error.code === '23505') {
        throw new ConflictException('Este e-mail já está em uso.');
      }
      throw error;
    }
  }
}
