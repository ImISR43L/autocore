import * as fs from 'fs';

export function getSecret(envVarName: string, secretFileName: string): string {
  const envVal = process.env[envVarName];

  if (envVal !== undefined && envVal !== null && envVal !== '') {
    return envVal;
  }

  const secretPath = `/run/secrets/${secretFileName}`;
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    } catch (err) {
      throw new Error(
        'Falha de segurança: I/O bloqueado ao instanciar credenciais protegidas.',
      );
    }
  }

  throw new Error(
    'Falha de inicialização: Credenciais de núcleo ausentes no provedor de ambiente.',
  );
}
