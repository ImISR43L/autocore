import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Classroom } from '../classrooms/entities/classroom.entity';
import { Submission } from '../submissions/entities/submission.entity';
import { stringify } from 'csv-stringify';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
  ) {}

  async generateClassroomReport(
    classroomId: number,
    requesterId: number,
  ): Promise<StreamableFile> {
    // 1. Validação de Segurança
    const classroom = await this.classroomsRepository.findOne({
      where: { id: classroomId },
      relations: ['owner', 'students', 'problems'],
      order: {
        problems: { createdAt: 'ASC' },
        students: { name: 'ASC' },
      } as any,
    });

    if (!classroom) throw new NotFoundException('Turma não encontrada');
    if (classroom.owner.id !== requesterId) {
      throw new ForbiddenException(
        'Apenas o professor pode exportar relatórios.',
      );
    }

    // 2. Buscar TODAS as submissões desta turma (Otimizado)
    // Buscamos apenas os campos necessários para montar a nota
    const submissions = await this.submissionsRepository.find({
      where: { problem: { classroom: { id: classroomId } } },
      relations: ['user', 'problem'],
      // Sintaxe de Objeto: Explícita e Segura
      select: {
        id: true,
        grade: true,
        status: true,
        createdAt: true,
        user: {
          id: true, // Garante que o ID do usuário venha
          name: true, // (Opcional) Se quiser usar o nome da submissão como fallback
        },
        problem: {
          id: true, // Garante que o ID do problema venha
        },
      },
    });

    // 3. Mapa de Notas em Memória: [UserId][ProblemId] = { grade, status }
    // Usamos um mapa para acesso O(1) durante a geração do CSV
    const gradeMap = new Map<string, any>();

    submissions.forEach((sub) => {
      const key = `${sub.user.id}-${sub.problem.id}`;
      const current = gradeMap.get(key);

      // Lógica: Mantemos a maior nota, ou a última se as notas forem iguais
      // (Você pode ajustar para "Última Submissão" se preferir)
      const subGrade = sub.grade || 0;
      if (!current || subGrade > current.grade) {
        gradeMap.set(key, {
          grade: subGrade,
          status: sub.status,
        });
      }
    });

    // 4. Configurar o Stream CSV
    const stringifier = stringify({
      header: true,
      columns: [
        'Aluno ID',
        'Nome',
        'Email',
        ...classroom.problems.map((p) => `Prob: ${p.title} (Pts)`),
        ...classroom.problems.map((p) => `Status: ${p.title}`),
      ],
      bom: true, // Adiciona Byte Order Mark para o Excel abrir acentos corretamente (UTF-8)
      delimiter: ';', // Ponto e vírgula é melhor para Excel em PT-BR
    });

    // 5. Injetar dados no Stream (Processo Assíncrono)
    // Não usamos 'await' aqui para não bloquear. O stream flui enquanto o Node processa.
    (async () => {
      for (const student of classroom.students) {
        // Lógica de Fallback: Se não tiver nome, usa o que vem antes do @ no e-mail
        const displayName = student.name
          ? student.name
          : student.email.split('@')[0];

        const row: any = {
          'Aluno ID': student.id,
          Nome: displayName, // Agora usa a variável tratada
          Email: student.email,
        };

        // Preenche colunas dinâmicas dos problemas
        classroom.problems.forEach((problem) => {
          const key = `${student.id}-${problem.id}`;
          const data = gradeMap.get(key);

          row[`Prob: ${problem.title} (Pts)`] = data ? data.grade : 0;
          row[`Status: ${problem.title}`] = data ? data.status : 'Pendente';
        });

        stringifier.write(row);
      }
      stringifier.end();
    })();

    // 6. Retorna o Arquivo "Streamável"
    return new StreamableFile(stringifier, {
      type: 'text/csv',
      disposition: `attachment; filename="Relatorio_Turma_${classroom.code}.csv"`,
    });
  }
}
