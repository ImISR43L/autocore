import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL as string;

// createRemoteJWKSet cuida do cache sozinho: só busca o JWKS de novo se
// aparecer um "kid" (key id) que ainda não está no cache local (ex: após
// rotação de chave) — não é uma chamada de rede por requisição.
const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authHeader = req.headers?.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // Caminho principal: chaves assimétricas novas (ES256), verificadas
      // via chave pública do JWKS.
      try {
        const { payload } = await jwtVerify(token, JWKS, {
          issuer: `${SUPABASE_URL}/auth/v1`,
        });
        if (payload?.sub) {
          return `user:${payload.sub}`;
        }
      } catch {
        // Fallback: tokens HS256 legados (ex: sessões antigas emitidas
        // antes de uma eventual migração para chaves assimétricas). Só
        // entra aqui se você realmente ainda tiver SUPABASE_JWT_SECRET
        // configurado — projetos 100% migrados podem remover isso.
        if (process.env.SUPABASE_JWT_SECRET) {
          try {
            const payload: any = jwt.verify(
              token,
              process.env.SUPABASE_JWT_SECRET as string,
              { algorithms: ['HS256'] },
            );
            if (payload?.sub) {
              return `user:${payload.sub}`;
            }
          } catch {
            // nem JWKS nem secret legado bateram — cai pro IP abaixo
          }
        }
      }
    }

    return req.ips?.length ? req.ips[0] : req.ip;
  }
}
