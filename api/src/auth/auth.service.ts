import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { AuthDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(authDto: AuthDto) {
    const hashedPassword = await bcrypt.hash(authDto.password, 10);
    const user = this.usersRepository.create({
      email: authDto.email,
      password: hashedPassword,
      role: authDto.role || undefined,
    });
    await this.usersRepository.save(user);
    return { message: 'Usuário criado com sucesso' };
  }

  async login(authDto: AuthDto) {
    const user = await this.usersRepository.findOne({
      where: { email: authDto.email },
    });

    if (!user || !(await bcrypt.compare(authDto.password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      role: user.role,
      email: user.email,
    };
  }
}
