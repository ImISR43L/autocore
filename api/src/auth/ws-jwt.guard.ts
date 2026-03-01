import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const client = context.switchToWs().getClient<Socket>();

    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    // Injeção de emulação de cabeçalho para compatibilidade direta com o Passport JwtStrategy existente
    const mockRequest = Object.assign(client, {
      headers: {
        authorization: token?.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
    });

    return mockRequest;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new WsException(
        'Acesso WSS Negado: Certificado JWT inválido ou expirado.',
      );
    }
    return user;
  }
}
