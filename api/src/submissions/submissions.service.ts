// src/submissions/submissions.service.ts

import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'; // Adicione OnModuleInit
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Submission } from './entities/submission.entity';
// IMPORT CORRIGIDO (Igual ao Problem):
import { Problem } from '../problems/entities/problem.entity';
import { TestCase } from '../problems/entities/test-case.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService implements OnModuleInit {
  private readonly judge0Url = 'https://judge0-ce.p.rapidapi.com';

  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    console.log('[SEED] Verificando e criando problema padrão...');
    await this.seedProblem();
  }

  async executeCode(data: CreateSubmissionDto) {
    const { code, language_id, problem_id } = data as any;
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');

    console.log(`[DEBUG] Recebida submissão para Problema ID: ${problem_id}`);

    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases'],
    });

    if (!problem) {
      console.error(`[DEBUG] Erro: Problema ID ${problem_id} não encontrado.`);
      throw new NotFoundException('Problema não encontrado');
    }

    if (!problem.testCases || problem.testCases.length === 0) {
      return { status: 'Configuration Error: Problem has 0 Test Cases' };
    }

    let finalStatus = 'Accepted';

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

        if (result.status.id !== 3) {
          finalStatus = result.status.description;
          break;
        }

        const runOutput = result.stdout
          ? Buffer.from(result.stdout, 'base64').toString('utf-8').trim()
          : '';

        // CORREÇÃO 1: expectedOutput (camelCase)
        const expected = testCase.expectedOutput.trim();

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

    const newSubmission = this.submissionsRepository.create({
      code: code,
      language_id: language_id,
      problem: problem,
      status: finalStatus,
    });

    await this.submissionsRepository.save(newSubmission);

    return { status: finalStatus };
  }

  async seedProblem() {
    const title = 'Soma Simples';
    const existing = await this.problemsRepository.findOne({
      where: { title },
    });

    if (existing) {
      await this.problemsRepository.remove(existing);
    }

    const problem = this.problemsRepository.create({
      title: title,
      description: 'Leia dois valores inteiros e imprima a soma deles.',
      slug: 'soma-simples', // Adicionei slug pois é obrigatório na entidade Problem
    });
    const savedProblem = await this.problemsRepository.save(problem);

    // CORREÇÃO 2: expectedOutput (camelCase)
    const t1 = this.testCasesRepository.create({
      input: '5 5',
      expectedOutput: '10',
      problem: savedProblem,
    });

    const t2 = this.testCasesRepository.create({
      input: '-10 20',
      expectedOutput: '10',
      problem: savedProblem,
    });

    await this.testCasesRepository.save([t1, t2]);

    return `Problema ID ${savedProblem.id} recriado.`;
  }

  async findAll() {
    return this.submissionsRepository.find({
      order: { created_at: 'DESC' },
      relations: ['problem'],
      take: 10,
    });
  }
}
