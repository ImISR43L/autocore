import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Submission } from './entities/submission.entity';
import { Problem } from './entities/problem.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    private configService: ConfigService,
  ) {}

  async executeCode(data: CreateSubmissionDto) {
    // Agora esperamos receber problem_id ao invés de stdin manual
    const { code, language_id, problem_id } = data as any;
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');

    // 1. Buscar o Problema e seus Test Cases
    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    let finalStatus = 'Accepted';

    // 2. Loop de Execução (O Corretor)
    for (const testCase of problem.testCases) {
      const base64Code = Buffer.from(code).toString('base64');
      const base64Stdin = Buffer.from(testCase.input).toString('base64');

      try {
        const response = await axios.post(
          `${this.judge0Url}/submissions?base64_encoded=true&wait=true`,
          {
            source_code: base64Code,
            language_id: language_id,
            stdin: base64Stdin,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-RapidAPI-Key': apiKey,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            },
          },
        );

        const result = response.data;

        // Decodifica a saída
        const runOutput = result.stdout
          ? Buffer.from(result.stdout, 'base64').toString('utf-8').trim()
          : '';

        const expected = testCase.expected_output.trim();

        // 3. Comparação (A Lógica de Juiz)
        if (runOutput !== expected) {
          finalStatus = 'Wrong Answer';
          // Opcional: Salvar qual teste falhou ou logar o erro
          console.log(
            `Falhou no teste ID ${testCase.id}. Esperado: ${expected}, Recebido: ${runOutput}`,
          );
          break; // Para de gastar cota se já errou
        }

        // Se houver erro de compilação ou runtime
        if (result.status.id >= 3 && result.status.id !== 3) {
          // 3 = Accepted
          finalStatus = result.status.description;
          break;
        }
      } catch (error) {
        console.error('Erro na API Judge0:', error);
        finalStatus = 'Error';
        break;
      }
    }

    // 4. Salvar Submissão
    const newSubmission = this.submissionsRepository.create({
      code: code,
      language_id: language_id,
      problem: problem,
      status: finalStatus,
    });

    await this.submissionsRepository.save(newSubmission);

    return { status: finalStatus };
  }

  // Método auxiliar para criar problemas (Seed)
  async seedProblem() {
    const p = this.problemsRepository.create({
      title: 'Soma Simples',
      description: 'Leia dois valores inteiros e imprima a soma deles.',
    });
    const savedP = await this.problemsRepository.save(p);

    // Criando Test Cases (I/O Fixos)
    // Teste 1: 5 + 5 = 10
    await this.problemsRepository.manager.query(
      `INSERT INTO test_case (input, expected_output, "problemId") VALUES ('5 5', '10', ${savedP.id})`,
    );
    // Teste 2: -10 + 20 = 10
    await this.problemsRepository.manager.query(
      `INSERT INTO test_case (input, expected_output, "problemId") VALUES ('-10 20', '10', ${savedP.id})`,
    );

    return 'Problema Seed Criado';
  }

  async findAll() {
    return this.submissionsRepository.find({
      order: { created_at: 'DESC' },
      relations: ['problem'], // Traz o problema junto
      take: 10,
    });
  }
}
