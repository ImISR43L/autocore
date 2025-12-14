import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Submission } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    private configService: ConfigService,
  ) {}

  async executeCode(data: CreateSubmissionDto) {
    const { code, language_id, stdin } = data;

    // CORREÇÃO: Buscamos a chave aqui dentro, onde o serviço já está pronto
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');

    // Validação extra (opcional) para garantir que a chave existe
    if (!apiKey) {
      console.error('ERRO CRÍTICO: RAPIDAPI_KEY não encontrada no .env');
      return { error: 'Configuração de servidor inválida' };
    }

    const base64Code = Buffer.from(code).toString('base64');
    const base64Stdin = stdin ? Buffer.from(stdin).toString('base64') : '';

    const payload = {
      source_code: base64Code,
      language_id: language_id,
      stdin: base64Stdin,
    };

    try {
      const response = await axios.post(
        `${this.judge0Url}/submissions?base64_encoded=true&wait=true`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': apiKey,
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

      const newSubmission = this.submissionsRepository.create({
        code: code,
        language_id: language_id,
        stdin: stdin || '',
        stdout: decodedStdout,
        stderr: decodedStderr,
        status: result.status?.description || 'Unknown',
      });

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
