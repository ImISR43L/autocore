import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Submission } from './entities/submission.entity';

@Injectable()
export class SubmissionsService {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';
  // Lembre-se de manter sua API Key aqui
  private readonly apiKey =
    'b634d42f29mshb773397ed4902e0p1b001ejsn545bd3de7177';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
  ) {}

  async executeCode(source_code: string) {
    const base64Code = Buffer.from(source_code).toString('base64');
    const payload = { source_code: base64Code, language_id: 71, stdin: '' };

    try {
      // 1. Executa na Nuvem
      const response = await axios.post(
        `${this.judge0Url}/submissions?base64_encoded=true&wait=true`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
        },
      );

      const data = response.data;

      // 2. Decodifica o resultado para salvar no banco legível
      const decodedStdout = data.stdout
        ? Buffer.from(data.stdout, 'base64').toString('utf-8')
        : null;
      const decodedStderr = data.stderr
        ? Buffer.from(data.stderr, 'base64').toString('utf-8')
        : null;

      // 3. Salva no Banco (Persistência)
      // 3. Salva no Banco (Persistência)
      // O 'as any' força o TypeScript a aceitar o objeto, ignorando o erro de tipagem falso
      const newSubmission = this.submissionsRepository.create({
        code: source_code,
        language_id: 71,
        stdout: decodedStdout,
        stderr: decodedStderr,
        status: data.status?.description || 'Unknown',
      } as any);

      await this.submissionsRepository.save(newSubmission);

      await this.submissionsRepository.save(newSubmission);

      // Retorna o dado original para o frontend (mantendo compatibilidade)
      return data;
    } catch (error) {
      console.error('Erro:', error);
      return { error: 'Falha na execução' };
    }
  }

  // Novo método para listar histórico
  async findAll() {
    return this.submissionsRepository.find({
      order: { created_at: 'DESC' },
      take: 10, // Retorna os últimos 10
    });
  }
}
