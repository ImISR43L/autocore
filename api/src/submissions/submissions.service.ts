import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Submission } from './entities/submission.entity';

// Definição do objeto esperado
interface ExecuteDto {
  code: string;
  language_id: number;
  stdin?: string;
}

@Injectable()
export class SubmissionsService {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';
  // Sua chave RapidAPI (mantida a partir do seu upload anterior)
  private readonly apiKey =
    'b634d42f29mshb773397ed4902e0p1b001ejsn545bd3de7177';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
  ) {}

  async executeCode(data: ExecuteDto) {
    // Extrai os dados dinâmicos recebidos do Frontend
    const { code, language_id, stdin } = data;

    const base64Code = Buffer.from(code).toString('base64');
    const base64Stdin = stdin ? Buffer.from(stdin).toString('base64') : '';

    const payload = {
      source_code: base64Code,
      language_id: language_id, // <--- O PULO DO GATO: Agora usa o ID variável
      stdin: base64Stdin,
    };

    try {
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

      const result = response.data;

      const decodedStdout = result.stdout
        ? Buffer.from(result.stdout, 'base64').toString('utf-8')
        : null;
      const decodedStderr = result.stderr
        ? Buffer.from(result.stderr, 'base64').toString('utf-8')
        : null;

      // Persistência
      const newSubmission = this.submissionsRepository.create({
        code: code,
        language_id: language_id,
        stdin: stdin || '',
        stdout: decodedStdout,
        stderr: decodedStderr,
        status: result.status?.description || 'Unknown',
      } as any);

      await this.submissionsRepository.save(newSubmission);

      return result;
    } catch (error) {
      console.error('Erro na API Judge0:', error);
      return { error: 'Falha na execução' };
    }
  }

  async findAll() {
    return this.submissionsRepository.find({
      order: { created_at: 'DESC' },
      take: 10,
    });
  }
}
