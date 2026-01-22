import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 1. Interface para tipar o payload do token
interface JwtPayload {
  sub: number;
  email: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'SEGREDO_SUPER_SECRETO',
    });
  }

  // 2. Removido 'async' e tipado o payload
  validate(payload: JwtPayload) {
    // O que retornarmos aqui será injetado em "req.user"
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
