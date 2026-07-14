import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import axios from 'axios';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { DryRunDto } from './dto/dry-run.dto';
import {
  ParameterDefinition,
  Problem,
  ProblemType,
} from './entities/problem.entity';
import { TestCase } from './entities/test-case.entity';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { WrapperGenerator } from '../submissions/wrapper-generator';
import { ExamAccessGrant } from '../exam-access/entities/exam-access-grant.entity';

@Injectable()
export class ProblemsService {
  private readonly logger = new Logger(ProblemsService.name);

  private readonly executorUrl =
    process.env.EXECUTOR_URL || 'http://go-judge:5050/run';

  constructor(
    @InjectRepository(Problem)
    private problemsRepository: Repository<Problem>,
    @InjectRepository(TestCase)
    private testCasesRepository: Repository<TestCase>,
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(ExamAccessGrant)
    private examAccessGrantsRepository: Repository<ExamAccessGrant>,
  ) {}

  /**
   * Verifica se o usuário tem um grant ativo (não revogado, não expirado)
   * para este problema específico, via token de acesso temporário de
   * prova. É a terceira via de autorização, além de dono/matriculado —
   * usada tanto por convidados anônimos quanto por usuários reais que
   * receberam um link de acesso pontual.
   *
   * Checa tanto o id do problema em si quanto o do seu PAI, quando
   * houver: o token/grant é concedido para a prova (o problema pai),
   * nunca para cada questão-filha individualmente.
   */
  private async hasActiveExamGrant(
    userId: string,
    problem: Problem,
  ): Promise<boolean> {
    const candidateIds = [problem.id];
    if (problem.parent?.id) candidateIds.push(problem.parent.id);

    const count = await this.examAccessGrantsRepository.count({
      where: {
        user: { id: userId },
        problemId: In(candidateIds),
        token: { revoked: false, expiresAt: MoreThan(new Date()) },
      },
    });
    return count > 0;
  }

  private compareOutputs(actual: string, expected: string): boolean {
    this.logger.debug(
      `[COMPARE-START]\nActual (Raw):   ${JSON.stringify(actual)}\nExpected (Raw): ${JSON.stringify(expected)}`,
    );

    if (!actual && !expected) return true;
    if (!actual || !expected) {
      this.logger.debug(`[COMPARE-FAIL] Um dos valores é vazio.`);
      return false;
    }

    // 1. Limpeza básica
    const clean = (s: string) =>
      s
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
    const a = clean(actual);
    const e = clean(expected);

    if (a === e) {
      this.logger.debug(`[COMPARE-SUCCESS] Match exato após trim.`);
      return true;
    }

    // 2. Comparação Linha a Linha
    const aLines = a.split('\n').map((l) => l.trimEnd());
    const eLines = e.split('\n').map((l) => l.trimEnd());
    if (
      aLines.length === eLines.length &&
      aLines.every((line, i) => line === eLines[i])
    ) {
      this.logger.debug(`[COMPARE-SUCCESS] Match linha a linha.`);
      return true;
    }

    // 3. Comparação Semântica (JSON)
    try {
      const objA = JSON.parse(a);
      const objE = JSON.parse(e);
      if (JSON.stringify(objA) === JSON.stringify(objE)) {
        this.logger.debug(`[COMPARE-SUCCESS] Match via JSON Parse.`);
        return true;
      }
    } catch {
      // Ignora erro
    }

    // 4. Normalização Canônica (Agressiva)
    const normalize = (str: string) => {
      return str
        .replace(/\s+/g, '') // Remove TODOS os espaços/newlines
        .replace(/[\u2018\u2019]/g, "'") // Padroniza Smart Quotes Simples
        .replace(/[\u201C\u201D]/g, '"') // Padroniza Smart Quotes Duplas
        .replace(/'/g, '"') // Transforma aspas simples em duplas
        .replace(/\(/g, '[') // Tupla -> Array
        .replace(/\)/g, ']')
        .replace(/\bTrue\b/g, 'true') // Python Booleans
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/;$/, '');
    };

    const normA = normalize(a);
    const normE = normalize(e);

    this.logger.debug(
      `[COMPARE-NORM]\nNorm Actual:   "${normA}"\nNorm Expected: "${normE}"\nIguais?        ${normA === normE}`,
    );

    if (normA === normE) {
      this.logger.debug(`[COMPARE-SUCCESS] Match após normalização.`);
      return true;
    }

    this.logger.debug(`[COMPARE-FAIL] Nenhuma estratégia funcionou.`);
    return false;
  }

  async create(createProblemDto: CreateProblemDto, userId: string) {
    const {
      classroomId,
      questions,
      parameters,
      startDate,
      deadline,
      ...problemData
    } = createProblemDto;

    if (!classroomId) {
      throw new BadRequestException(
        'A vinculação a uma turma (classroomId) é obrigatória.',
      );
    }

    const classroom = await this.classroomsRepository.findOne({
      where: { id: String(classroomId) },
      relations: ['owner'],
    });

    if (!classroom) {
      throw new NotFoundException('Turma não encontrada.');
    }

    // CORREÇÃO DE SEGURANÇA: o controller já recebia req.user, mas nunca
    // repassava o userId pra cá — qualquer usuário autenticado da
    // plataforma conseguia criar problemas em QUALQUER turma, bastando
    // saber o classroomId. Mesma checagem que update()/remove() já
    // fazem, só que ausente aqui.
    if (classroom.owner?.id !== userId) {
      throw new ForbiddenException(
        'Apenas o dono da turma pode criar atividades.',
      );
    }

    if (classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    const existingProblem = await this.problemsRepository.findOne({
      where: {
        slug: createProblemDto.slug,
        classroom: { id: createProblemDto.classroomId },
      },
    });

    if (existingProblem) {
      throw new ConflictException('Este slug já está em uso nesta turma.');
    }

    let children: Problem[] = [];
    if (questions && questions.length > 0) {
      children = questions.map((q) =>
        this.problemsRepository.create({
          ...q,
          slug: `${createProblemDto.slug}--${q.slug}`, // ex: "prova-1--q1"
          type: ProblemType.EXERCISE,
          classroom: classroom,
          parameters: q.parameters as unknown as ParameterDefinition[],
          starterCode: q.starterCode as any,
          solutionCode: q.solutionCode as any,
          testCases: q.testCases
            ? q.testCases.map((tc) =>
                this.testCasesRepository.create({ ...tc }),
              )
            : [],
        }),
      );
    }

    // BLINDAGEM: uma prova com questões é apenas um invólucro (Fase 2 do
    // plano de separação Pai/Filho). Os dados de execução (código, testes,
    // parâmetros e limites de tempo/memória) pertencem exclusivamente às
    // questões-filhas — nunca ao pai. Isso evita que um limite de
    // tempo/memória "global" do pai vaze e afete questões de linguagens
    // diferentes, e evita dados órfãos no pai quando ele também possui
    // essas colunas (usadas normalmente por um EXERCISE avulso sem filhos).
    // `maxAttempts` é a única exceção: é uma configuração de escopo de
    // prova inteira (quantas tentativas o aluno tem na prova como um
    // todo), então permanece no pai mesmo quando há questões.
    const isExamShell = children.length > 0;

    const problem = this.problemsRepository.create({
      ...problemData,
      startDate: startDate ? new Date(startDate) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
      parameters: isExamShell
        ? []
        : (parameters as unknown as ParameterDefinition[]),
      starterCode: isExamShell ? null : (problemData.starterCode as any),
      solutionCode: isExamShell ? [] : (problemData.solutionCode as any),
      testCases: isExamShell ? [] : ((problemData as any).testCases as any),
      timeLimit: isExamShell ? null : (problemData as any).timeLimit,
      memoryLimit: isExamShell ? null : (problemData as any).memoryLimit,
      classroom: classroom,
      children: children.length > 0 ? children : undefined,
    });

    return this.problemsRepository.save(problem);
  }

  async findAll(userId: string) {
    // CORREÇÃO DE SEGURANÇA: sem guard nenhum antes, retornava título,
    // descrição, testCases (inclusive os não-ocultos de QUALQUER turma)
    // pra qualquer requisição não autenticada. Conferi contra
    // exam-access.controller.ts — o fluxo de convidado usa
    // GET /exam-access/:token + POST /exam-access/:token/redeem, nunca
    // este endpoint, então não há caso de uso legítimo de listagem
    // pública aqui. Escopo agora replica as duas primeiras camadas de
    // autorização que findOne() já usa (dono da turma OU matriculado) —
    // a terceira camada de findOne() (grant de prova) não se aplica a
    // uma listagem geral, só a UM problema específico via token.
    const problems = await this.problemsRepository
      .createQueryBuilder('problem')
      .leftJoinAndSelect('problem.classroom', 'classroom')
      .leftJoin('classroom.owner', 'owner')
      .leftJoin('classroom.students', 'student')
      .where('owner.id = :userId', { userId })
      .orWhere('student.id = :userId', { userId })
      .getMany();

    // Proteção de dados: Ocultar gabarito em listagens públicas
    problems.forEach((problem) => {
      delete (problem as any).solutionCode;
    });

    return problems;
  }

  async findOne(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: [
        'testCases',
        'children',
        'children.testCases',
        'classroom',
        'classroom.owner',
        'classroom.students',
        'parent',
      ],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    const isOwner =
      problem.classroom &&
      String(problem.classroom.owner?.id) === String(userId);

    // CORREÇÃO DE SEGURANÇA: antes disto, qualquer usuário autenticado da
    // plataforma — matriculado ou não — conseguia ver qualquer problema só
    // sabendo o UUID (a checagem só distinguia "é o dono" vs "não é",
    // nunca "pertence a esta turma"). Isso é checado ANTES do bloco de
    // auto-start logo abaixo, pra uma requisição não autorizada não
    // conseguir nem sequer disparar o início automático da prova pra
    // todo mundo.
    const isEnrolled =
      !isOwner &&
      problem.classroom?.students?.some(
        (student) => String(student.id) === String(userId),
      );

    const hasGrant =
      !isOwner &&
      !isEnrolled &&
      (await this.hasActiveExamGrant(userId, problem));

    if (!isOwner && !isEnrolled && !hasGrant) {
      throw new ForbiddenException('Você não tem acesso a esta atividade.');
    }

    if (
      problem.type === ProblemType.EXAM &&
      !problem.startedAt &&
      problem.startDate &&
      problem.startDate <= new Date()
    ) {
      this.logger.log(
        `[AutoStart] Iniciando prova ${problem.id} automaticamente.`,
      );
      problem.startedAt = problem.startDate;
      await this.problemsRepository.save(problem);
    }

    if (!isOwner) {
      delete (problem as any).solutionCode;

      if (problem.children && problem.children.length > 0) {
        problem.children.forEach((child) => delete (child as any).solutionCode);
      }

      if (problem.type === ProblemType.EXAM) {
        const now = new Date();
        if (!problem.startedAt || problem.startedAt > now) {
          throw new ForbiddenException(
            'Esta prova ainda não foi iniciada pelo professor.',
          );
        }
      }

      if (problem.testCases) {
        problem.testCases = problem.testCases.filter((tc) => !tc.isHidden);
      }
      if (problem.children && problem.children.length > 0) {
        problem.children.forEach((child) => {
          if (child.testCases) {
            child.testCases = child.testCases.filter((tc) => !tc.isHidden);
          }
        });
      }
    }

    return problem;
  }

  async startExam(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Prova não encontrada');

    if (problem.classroom.owner?.id !== userId)
      throw new ForbiddenException('Apenas o professor pode iniciar.');

    if (problem.type !== ProblemType.EXAM)
      throw new ForbiddenException('Apenas provas podem ser iniciadas.');

    problem.startedAt = new Date();
    return this.problemsRepository.save(problem);
  }

  async endExam(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Prova não encontrada');

    if (problem.classroom.owner?.id !== userId)
      throw new ForbiddenException('Apenas o professor pode encerrar.');

    if (problem.type !== ProblemType.EXAM)
      throw new ForbiddenException('Apenas provas podem ser encerradas.');

    // Encerrar = definir o prazo final para agora. Reaproveitamos a mesma
    // lógica de "isFinished" (now > deadline) que o front-end já usa para
    // calcular o status da prova, em vez de criar uma coluna nova só para
    // isso — funciona mesmo em provas que nunca tiveram deadline definido
    // (que, sem isso, nunca chegam ao estado FINISHED sozinhas).
    problem.deadline = new Date();
    return this.problemsRepository.save(problem);
  }

  async update(id: string, updateProblemDto: UpdateProblemDto, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: [
        'children',
        'children.testCases',
        'testCases',
        'classroom',
        'classroom.owner',
      ],
    });
    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (!problem.classroom) {
      throw new ForbiddenException(
        'Atividades sem turma não possuem proprietário e não podem ser editadas.',
      );
    }

    if (problem.classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    if (problem.classroom.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode editar.');
    }

    const {
      questions,
      testCases,
      parameters,
      classroomId: _classroomId,
      deadline,
      startDate,
      slug,
      ...dataToUpdate
    } = updateProblemDto;

    // Limpeza rigorosa para evitar que TypeORM sobrescreva campos estruturais no Object.assign
    delete (dataToUpdate as any).startedAt;
    delete (dataToUpdate as any).createdAt;
    delete (dataToUpdate as any).updatedAt;
    delete (dataToUpdate as any).id;
    delete (dataToUpdate as any).classroom;
    delete (dataToUpdate as any).children;

    // BLINDAGEM (Fase 2): se o problema é (ou está se tornando) uma prova
    // com questões, ele é só um invólucro — os dados de execução pertencem
    // às questões-filhas, nunca ao pai. Usamos o tipo resultante (o que
    // vier no PATCH, ou o já persistido) em vez de depender apenas de
    // `questions` ter sido enviado neste request específico, para que o
    // pai nunca fique com lixo de execução mesmo em updates parciais.
    // `maxAttempts` fica de fora: é configuração da prova inteira, não de
    // execução de código, então continua pertencendo ao pai.
    const resultingType = (dataToUpdate as any).type ?? problem.type;
    const isExamShell = resultingType === ProblemType.EXAM;

    if (isExamShell) {
      (dataToUpdate as any).starterCode = null;
      (dataToUpdate as any).solutionCode = [];
      (dataToUpdate as any).timeLimit = null;
      (dataToUpdate as any).memoryLimit = null;
    }

    if (questions) {
      const existingChildren = problem.children || [];

      // Casa cada questão enviada com a questão-filha já persistida (via
      // `id`, quando presente). Isso é essencial: se simplesmente
      // apagássemos tudo e recriássemos com IDs novos a cada edição —
      // como o código fazia antes — toda submissão, tentativa e entrega
      // que os alunos já tinham feito (todas ligadas ao ID antigo da
      // questão) ficaria órfã. Para o aluno, a prova "virava outra" a
      // cada vez que o professor editava qualquer coisa nela, mesmo no
      // meio da prova ou depois de encerrada.
      const incomingIds = new Set(
        questions
          .map((q) => (q as any).id)
          .filter((qid): qid is string => Boolean(qid)),
      );

      // Só remove as questões-filhas que o professor realmente excluiu
      // (não aparecem mais na lista enviada) — não todas.
      const childrenToRemove = existingChildren.filter(
        (c) => !incomingIds.has(c.id),
      );
      if (childrenToRemove.length > 0) {
        await this.problemsRepository.remove(childrenToRemove);
      }

      // Casos de teste antigos das questões REAPROVEITADAS (não das que
      // acabaram de ser removidas acima, cujos testCases já vão junto via
      // cascade) precisam ser apagados antes de atribuir os novos, já que
      // simplesmente reatribuir `existingChild.testCases` em memória não
      // garante a exclusão das linhas antigas no banco sem depender de
      // orphanedRowAction — configuração que preferimos não ligar
      // globalmente na entidade só por causa deste método (ela afetaria
      // qualquer outro código que toque essa relação, com risco de apagar
      // dados por engano se algum outro fluxo carregar a relação
      // parcialmente). Em vez de um DELETE por questão, juntamos os ids de
      // TODAS as questões reaproveitadas nesta edição e apagamos tudo numa
      // única consulta em lote.
      const oldTestCaseIdsToRemove: string[] = [];
      for (const q of questions) {
        const incomingId = (q as any).id as string | undefined;
        if (!incomingId) continue;
        const existingChild = existingChildren.find((c) => c.id === incomingId);
        if (existingChild?.testCases?.length) {
          oldTestCaseIdsToRemove.push(
            ...existingChild.testCases.map((tc) => tc.id),
          );
        }
      }
      if (oldTestCaseIdsToRemove.length > 0) {
        await this.testCasesRepository.delete({
          id: In(oldTestCaseIdsToRemove),
        });
      }

      // merge()/create() abaixo são operações em memória (não tocam o
      // banco) — a escrita real acontece só no `save()` final, em cascata,
      // então este map não precisa ser assíncrono.
      problem.children = questions.map((q) => {
        const incomingId = (q as any).id as string | undefined;
        const existingChild = incomingId
          ? existingChildren.find((c) => c.id === incomingId)
          : undefined;

        const childParams = q.parameters as unknown as ParameterDefinition[];

        const buildTestCases = () =>
          q.testCases
            ? q.testCases.map((tc) => {
                delete (tc as any).id; // Sempre força INSERT novo do caso de teste
                return this.testCasesRepository.create({ ...tc });
              })
            : [];

        const cleanQuestion = { ...q };
        delete (cleanQuestion as any).id;
        delete (cleanQuestion as any).classroom;
        delete (cleanQuestion as any).children;

        if (existingChild) {
          // ATUALIZA em vez de recriar: preserva o ID da questão-filha,
          // então todo o histórico de submissões continua válido.
          return this.problemsRepository.merge(existingChild, {
            ...cleanQuestion,
            id: existingChild.id,
            type: problem.type,
            classroom: problem.classroom,
            parameters: childParams,
            slug: `${updateProblemDto.slug ?? problem.slug}--${q.slug}`,
            starterCode: q.starterCode as any,
            solutionCode: q.solutionCode as any,
            testCases: buildTestCases(),
          }) as unknown as Problem;
        }

        // Sem id correspondente = questão nova, criada nesta edição.
        return this.problemsRepository.create({
          ...cleanQuestion,
          type: problem.type,
          classroom: problem.classroom,
          parameters: childParams,
          slug: `${updateProblemDto.slug ?? problem.slug}--${q.slug}`,
          starterCode: q.starterCode as any,
          solutionCode: q.solutionCode as any,
          testCases: buildTestCases(),
        }) as unknown as Problem;
      });
    }

    if (testCases) {
      if (problem.testCases && problem.testCases.length > 0) {
        await this.testCasesRepository.remove(problem.testCases);
      }
      problem.testCases = testCases.map((tc) => {
        delete (tc as any).id; // Remove ID para forçar INSERT real
        return this.testCasesRepository.create({ ...tc });
      });
    } else if (
      isExamShell &&
      problem.testCases &&
      problem.testCases.length > 0
    ) {
      // Prova sem testCases raiz enviados neste request: garante que
      // resíduos antigos do pai (de antes da separação Pai/Filho) sejam
      // removidos, já que o pai nunca deveria carregar casos de teste.
      await this.testCasesRepository.remove(problem.testCases);
      problem.testCases = [];
    }

    if (parameters) {
      problem.parameters = parameters as unknown as ParameterDefinition[];
    } else if (isExamShell) {
      problem.parameters = [] as any;
    }

    if (deadline !== undefined) {
      problem.deadline = (deadline ? new Date(deadline) : null) as any;
    }
    if (startDate !== undefined) {
      problem.startDate = (startDate ? new Date(startDate) : null) as any;
    }

    Object.assign(problem, {
      ...dataToUpdate,
      starterCode: dataToUpdate.starterCode as any,
      solutionCode: dataToUpdate.solutionCode as any,
    });

    return this.problemsRepository.save(problem);
  }

  async remove(id: string, userId: string) {
    const problem = await this.problemsRepository.findOne({
      where: { id },
      relations: ['classroom', 'classroom.owner'],
    });

    if (!problem) throw new NotFoundException('Problema não encontrado');

    if (!problem.classroom) {
      throw new ForbiddenException(
        'Atividades sem turma não possuem proprietário e não podem ser excluídas.',
      );
    }

    if (problem.classroom.isArchived) {
      throw new ForbiddenException(
        'Turma em modo leitura (arquivada). Ações bloqueadas.',
      );
    }

    if (problem.classroom.owner?.id !== userId) {
      throw new ForbiddenException('Apenas o dono da turma pode excluir.');
    }

    return this.problemsRepository.remove(problem);
  }

  async dryRun(dto: DryRunDto) {
    this.logger.log(`[DryRun] Iniciando execução para ${dto.language}`);

    const langConfig = this.getLanguageConfig(dto.language);
    if (!langConfig) {
      throw new InternalServerErrorException(
        `Linguagem ${dto.language} não suportada para Dry Run.`,
      );
    }

    const tempProblem = {
      parameters: dto.parameters as unknown as ParameterDefinition[],
      returnType: (dto as any).returnType || 'void',
    } as Problem;

    // Clone profundo para não afetar o payload original
    const filesClone = JSON.parse(JSON.stringify(dto.starterCode));

    // LIMPEZA CRÍTICA: Remove resíduos de wrappers antigos armazenados na BD ou cache
    filesClone.forEach((f: any) => {
      if (f.content) {
        const jsCppIndex = f.content.indexOf('// --- Wrapper Injetado');
        const pyIndex = f.content.indexOf('# --- Wrapper Injetado');

        if (jsCppIndex !== -1) {
          f.content = f.content.substring(0, jsCppIndex).trim();
        }
        if (pyIndex !== -1) {
          f.content = f.content.substring(0, pyIndex).trim();
        }
      }
    });

    // Aplica o Wrapper Inteligente no código purificado
    const processedFiles = WrapperGenerator.apply(
      filesClone,
      tempProblem,
      langConfig.id,
    );

    const mainFile = processedFiles.find((f) =>
      f.name.endsWith(langConfig.ext),
    );
    if (!mainFile) {
      throw new InternalServerErrorException(
        'Arquivo principal não encontrado após processamento.',
      );
    }

    const promises = dto.testCases.map(async (tc, index) => {
      try {
        const result = await this.executeInGoJudge(
          langConfig,
          processedFiles,
          tc.input,
        );

        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = tc.expectedOutput.trim();

        const status = this.compareOutputs(actualOutput, expectedOutput)
          ? 'ACCEPTED'
          : 'WRONG_ANSWER';

        return {
          id: index,
          status,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: actualOutput,
          error: result.stderr || result.error,
          executionTime: result.time ? `${result.time / 1000000}ms` : '0ms',
          memory: result.memory
            ? `${(result.memory / 1024 / 1024).toFixed(2)}MB`
            : '0MB',
        };
      } catch (error) {
        this.logger.error(
          `[DryRun] Erro no caso ${index}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          id: index,
          status: 'INTERNAL_ERROR',
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: '',
          error: 'Falha na comunicação com o executor.',
        };
      }
    });

    const results = await Promise.all(promises);

    return {
      success: results.every((r) => r.status === 'ACCEPTED'),
      results,
    };
  }

  private getLanguageConfig(lang: string) {
    const map: Record<
      string,
      { id: number; runCommand: string[]; ext: string }
    > = {
      python: {
        id: 71,
        ext: '.py',
        runCommand: ['python3', '-u', 'main.py'],
      },
      javascript: {
        id: 63,
        ext: '.js',
        runCommand: ['node', 'index.js'],
      },
      cpp: {
        id: 54,
        ext: '.cpp',
        runCommand: ['/bin/sh', '-c', 'g++ main.cpp -o main && ./main'],
      },
    };
    return map[lang.toLowerCase()] || null;
  }

  private async executeInGoJudge(
    config: { runCommand: string[]; ext: string },
    files: { name: string; content: string }[],
    stdin: string,
  ) {
    const copyIn: Record<string, { content: string }> = {};
    files.forEach((f) => {
      copyIn[f.name] = { content: f.content };
    });

    const payload = {
      cmd: [
        {
          args: config.runCommand,
          env: ['PATH=/usr/bin:/bin'],
          files: [
            { content: stdin },
            { name: 'stdout', max: 10240 },
            { name: 'stderr', max: 10240 },
          ],
          cpuLimit: 2000000000,
          memoryLimit: 128 * 1024 * 1024,
          procLimit: 50,
          copyIn,
        },
      ],
    };

    const { data } = await axios.post(this.executorUrl, payload);
    const result = data[0];

    if (result.status !== 'Accepted') {
      return {
        ...result,
        stdout: result.files['stdout'],
        stderr: result.files['stderr'] || `Erro de execução: ${result.status}`,
      };
    }

    return {
      ...result,
      stdout: result.files['stdout'],
      stderr: result.files['stderr'],
    };
  }
}
