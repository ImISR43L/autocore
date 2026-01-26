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

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    // CORREÇÃO: Usamos createQueryBuilder para incluir o campo 'password'
    // que agora está oculto por padrão (select: false).
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password') // <--- Traz a senha apenas aqui
      .where('user.email = :email', { email })
      .getOne();

    if (user && (await bcrypt.compare(pass, user.password))) {
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

    const payload = { email: user.email, sub: user.id, userId: user.id };

    return {
      access_token: this.jwtService.sign(payload),
      // Retornamos o nome também para o frontend usar
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async register(loginDto: AuthDto) {
    const hashedPassword = await bcrypt.hash(loginDto.password, 10);

    try {
      const user = this.usersRepository.create({
        email: loginDto.email,
        password: hashedPassword,
        // O nome começa null na criação simples, mas já preparamos o campo
      });

      const savedUser = await this.usersRepository.save(user);

      const payload = {
        email: savedUser.email,
        sub: savedUser.id,
        userId: savedUser.id,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: savedUser.id,
          email: savedUser.email,
          name: savedUser.name,
        },
      };
    } catch (error: unknown) {
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
