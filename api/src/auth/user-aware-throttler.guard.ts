import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { decode } from 'jsonwebtoken';

/**
 * Substitui o rastreamento padrão do ThrottlerGuard (por IP) por
 * rastreamento por usuário autenticado, extraído do claim `sub` do JWT.
 *
 * Por quê: o teste de carga (30 usuários simultâneos, mesma máquina)
 * expôs que o comportamento padrão por IP trata "30 pessoas diferentes
 * atrás do mesmo NAT" exatamente como "uma pessoa insistindo" — em uma
 * sala de aula/laboratório saindo por um IP compartilhado, isso
 * significa que o limite de `create()` (10/60s) é dividido entre TODOS
 * os alunos daquela sala, não por aluno.
 *
 * Uso de jwt.decode() (NÃO verify()) é intencional e seguro aqui: este
 * guard só decide em qual "balde" de contagem a requisição cai — nunca
 * autoriza nada sozinho. A verificação criptográfica de verdade
 * continua sendo feita pelo JwtAuthGuard normalmente. Na pior hipótese
 * (alguém manda um token forjado só pra ganhar um balde próprio), essa
 * requisição ainda é rejeitada pelo JwtAuthGuard logo depois — o pior
 * caso é "gastar" um slot de rate-limit à toa, não burlar autenticação.
 *
 * Requisições sem Authorization válido (ou sem claim `sub` decodificável)
 * caem de volta no rastreamento por IP — mesmo comportamento de antes
 * pra rotas públicas ou tokens malformados.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader: string | undefined = req.headers?.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice('Bearer '.length);
        const decoded = decode(token) as { sub?: string } | null;
        if (decoded?.sub) {
          return `user-${decoded.sub}`;
        }
      } catch {
        // token malformado — cai no fallback de IP abaixo
      }
    }

    return req.ip;
  }
}
