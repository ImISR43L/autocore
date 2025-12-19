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

    if (!problem) {
      throw new NotFoundException('Exercício não encontrado');
    }

    let finalVerdict = 'Accepted';
    const judgeUrl = process.env.JUDGE0_URL || 'http://judge0:2358';

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
            `${judgeUrl}/submissions/?base64_encoded=true&wait=true`,
            payload,
          );

          if (response.data.status.id !== 3) {
            finalVerdict = response.data.status.description;
            break;
          }
        } catch (error) {
          console.error('Judge0 Error:', error.message);
          finalVerdict = 'Internal Error';
          break;
        }
      }
    }

    // Criação da entidade usando os nomes corretos
    const submission = this.submissionsRepository.create({
      code: code,
      language_id: language_id,
      status: finalVerdict,
      problem: problem,
      user: { id: userId } as any, // Força a associação pelo ID
    });

    return this.submissionsRepository.save(submission);
  }

  async findAllByProblem(problemId: string) {
    return this.submissionsRepository.find({
      where: { problem: { id: problemId } },
      relations: ['user'],
      order: { created_at: 'DESC' },
    });
  }

  async findAll() {
    return this.submissionsRepository.find({ relations: ['problem', 'user'] });
  }

  async seedProblem() {
    return { msg: 'ok' };
  }
}
