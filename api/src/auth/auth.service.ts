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

  // 1. Tipagem correta do retorno (Remove 'any')
  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) {
      // 2. Ignora o erro de variável não usada para a desestruturação da password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // Agora 'user' é tipado, então .email e .id são seguros
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

      const payload = {
        email: savedUser.email,
        sub: savedUser.id,
        userId: savedUser.id,
      };
      return {
        access_token: this.jwtService.sign(payload),
        user: { id: savedUser.id, email: savedUser.email },
      };
    } catch (error: unknown) {
      // 3. Tratamento seguro de erro (sem 'any')
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Este e-mail já está em uso.');
      }
      throw error;
    }
  }
}
