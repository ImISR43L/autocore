import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Submission } from './entities/submission.entity';
import { Problem } from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity'; // Importação nova
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase) // Injeção do repositório de Testes
    private testCasesRepository: Repository<TestCase>,
    private configService: ConfigService,
  ) {}

  async executeCode(data: CreateSubmissionDto) {
    const { code, language_id, problem_id } = data as any;
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');

    console.log(`[DEBUG] Recebida submissão para Problema ID: ${problem_id}`); // LOG 1

    // 1. Buscar o Problema
    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases'],
    });

    if (!problem) {
      console.error(
        `[DEBUG] Erro: Problema ID ${problem_id} não encontrado no banco.`,
      );
      throw new NotFoundException('Problema não encontrado');
    }

    console.log(
      `[DEBUG] Problema encontrado: "${problem.title}". Qtd Testes: ${problem.testCases?.length}`,
    ); // LOG 2

    // TRAVA DE SEGURANÇA: Se não tem testes, lança erro em vez de fingir que funcionou
    if (!problem.testCases || problem.testCases.length === 0) {
      console.error(
        '[DEBUG] Erro Crítico: O problema existe mas não tem casos de teste.',
      );
      return { status: 'Configuration Error: Problem has 0 Test Cases' };
    }

    let finalStatus = 'Accepted';

    // 2. Loop de Execução
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

        // Verifica erro de execução antes de checar output
        if (result.status.id !== 3) {
          finalStatus = result.status.description;
          break;
        }

        const runOutput = result.stdout
          ? Buffer.from(result.stdout, 'base64').toString('utf-8').trim()
          : '';
        const expected = testCase.expected_output.trim();

        if (runOutput !== expected) {
          finalStatus = 'Wrong Answer';
          break;
        }
      } catch (error) {
        console.error('Erro na API Judge0:', error);
        finalStatus = 'Internal Error';
        break;
      }
    }

    // 3. Salvar
    const newSubmission = this.submissionsRepository.create({
      code: code,
      language_id: language_id,
      problem: problem,
      status: finalStatus,
    });

    await this.submissionsRepository.save(newSubmission);

    return { status: finalStatus };
  }

  // SEED SEGURO (Substituindo SQL manual)
  async seedProblem() {
    const title = 'Soma Simples';
    const existing = await this.problemsRepository.findOne({
      where: { title },
    });

    // Se já existe, removemos para recriar limpo (garante que os testes estarão lá)
    if (existing) {
      await this.problemsRepository.remove(existing);
    }

    // 1. Cria o Problema
    const problem = this.problemsRepository.create({
      title: title,
      description: 'Leia dois valores inteiros e imprima a soma deles.',
    });
    const savedProblem = await this.problemsRepository.save(problem);

    // 2. Cria os Casos de Teste vinculados via Objeto (TypeORM gerencia as chaves)
    const t1 = this.testCasesRepository.create({
      input: '5 5',
      expected_output: '10',
      problem: savedProblem,
    });

    const t2 = this.testCasesRepository.create({
      input: '-10 20',
      expected_output: '10',
      problem: savedProblem,
    });

    await this.testCasesRepository.save([t1, t2]);

    return `Problema ID ${savedProblem.id} recriado com sucesso e testes inseridos.`;
  }

  async findAll() {
    return this.submissionsRepository.find({
      order: { created_at: 'DESC' },
      relations: ['problem'],
      take: 10,
    });
  }
}
