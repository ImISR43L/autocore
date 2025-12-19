import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Submission } from './entities/submission.entity';
import { Problem } from '../problems/entities/problem.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
  ) {}

  async create(createSubmissionDto: CreateSubmissionDto, userId: number) {
    const { code, language_id, problem_id } = createSubmissionDto;

    const problem = await this.problemsRepository.findOne({
      where: { id: problem_id },
      relations: ['testCases'],
    });

    if (!problem) throw new NotFoundException('Exercício não encontrado');

    let finalVerdict = 'Accepted';

    // URL da RapidAPI
    const judgeUrl = 'https://judge0-ce.p.rapidapi.com/submissions';

    // Chave da API (Busca do .env ou usa uma string vazia se não tiver)
    // RECOMENDADO: Coloque sua chave no arquivo .env da API
    const rapidApiKey =
      process.env.RAPIDAPI_KEY ||
      'b634d42f29mshb773397ed4902e0p1b001ejsn545bd3de7177';

    if (problem.testCases && problem.testCases.length > 0) {
      for (const testCase of problem.testCases) {
        try {
          const payload = {
            source_code: Buffer.from(code).toString('base64'),
            language_id: language_id,
            stdin: Buffer.from(testCase.input).toString('base64'),
            expected_output: Buffer.from(testCase.expectedOutput).toString(
              'base64',
            ),
          };

          const response = await axios.post(
            `${judgeUrl}?base64_encoded=true&wait=true`,
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
                'x-rapidapi-key': rapidApiKey, // Cabeçalho obrigatório
              },
              timeout: 10000, // Timeout de 10s
            },
          );

          if (response.data.status.id !== 3) {
            finalVerdict = response.data.status.description;
            break;
          }
        } catch (error) {
          console.error(
            'Judge0 API Error:',
            error.response?.data || error.message,
          );
          finalVerdict = 'Execution Error'; // Erro na API ou na chave
          break;
        }
      }
    }

    const submission = this.submissionsRepository.create({
      code,
      language_id,
      status: finalVerdict,
      problem,
      user: { id: userId } as any,
    });

    return this.submissionsRepository.save(submission);
  }

  async findAllByProblem(problemId: string) {
    return this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async seedProblem() {
    return { msg: 'ok' };
  }
}
