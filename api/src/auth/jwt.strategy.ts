import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSecret } from '../common/utils/secrets.util';

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
      secretOrKey: getSecret('JWT_SECRET', 'jwt_secret'),
    });
  }

  // 2. Removido 'async' e tipado o payload
  validate(payload: JwtPayload) {
    // O que retornarmos aqui será injetado em "req.user"
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
