import * as fs from 'fs';

export function getSecret(envVarName: string, secretFileName: string): string {
  // 1. Tenta pegar da variável de ambiente (Dev mode ou Override)
  const envVal = process.env[envVarName];

  // CORREÇÃO: Verifica se existe valor. Se for undefined, passa para o próximo passo.
  if (envVal !== undefined && envVal !== null && envVal !== '') {
    return envVal;
  }

  // 2. Tenta ler do arquivo de segredo do Docker
  const secretPath = `/run/secrets/${secretFileName}`;
  if (fs.existsSync(secretPath)) {
    try {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    } catch (err) {
      console.error(`Erro ao ler segredo em ${secretPath}`, err);
    }
  }

  // 3. Retorno padrão seguro (String vazia em vez de undefined)
  // Em produção, você poderia lançar um erro aqui se a senha for obrigatória
  return '';
}
