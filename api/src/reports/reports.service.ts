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
import * as ExcelJS from 'exceljs'; // <--- Nova Importação

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Classroom)
    private classroomsRepository: Repository<Classroom>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
  ) {}

  // --- MÉTODO AUXILIAR (Reutiliza a lógica de busca) ---
  private async fetchReportData(classroomId: string, requesterId: string) {
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
    if (classroom.owner?.id !== requesterId) {
      throw new ForbiddenException(
        'Apenas o professor pode exportar relatórios.',
      );
    }

    // 2. Buscar Submissões
    const submissions = await this.submissionsRepository.find({
      where: { problem: { classroom: { id: classroomId } } },
      relations: ['user', 'problem'],
      select: {
        id: true,
        grade: true,
        status: true,
        createdAt: true,
        user: { id: true, name: true },
        problem: { id: true },
      },
    });

    // 3. Mapa de Notas
    const gradeMap = new Map<string, any>();
    submissions.forEach((sub) => {
      const key = `${sub.user.id}-${sub.problem.id}`;
      const current = gradeMap.get(key);
      const subGrade = sub.grade || 0;

      if (!current || subGrade > current.grade) {
        gradeMap.set(key, { grade: subGrade, status: sub.status });
      }
    });

    return { classroom, gradeMap };
  }

  // --- GERAÇÃO DE EXCEL (.xlsx) ---
  async generateClassroomExcel(
    classroomId: string,
    requesterId: string,
  ): Promise<StreamableFile> {
    const { classroom, gradeMap } = await this.fetchReportData(
      classroomId,
      requesterId,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Notas da Turma');

    // 1. Definir Colunas
    const columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Email', key: 'email', width: 35 },
    ];

    // Adiciona colunas dinâmicas para cada problema
    classroom.problems.forEach((p) => {
      columns.push({
        header: `${p.title} (Pts)`,
        key: `prob_${p.id}`,
        width: 15,
      });
      columns.push({ header: `Status`, key: `status_${p.id}`, width: 15 });
    });

    sheet.columns = columns;

    // 2. Estilizar Cabeçalho (Negrito e Fundo Cinza)
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // 3. Preencher Linhas
    for (const student of classroom.students) {
      const displayName = student.name
        ? student.name
        : student.email.split('@')[0];

      const rowData: any = {
        id: student.id,
        name: displayName,
        email: student.email,
      };

      classroom.problems.forEach((problem) => {
        const key = `${student.id}-${problem.id}`;
        const data = gradeMap.get(key);

        rowData[`prob_${problem.id}`] = data ? data.grade : 0;
        rowData[`status_${problem.id}`] = data ? data.status : 'Pendente';
      });

      sheet.addRow(rowData);
    }

    // 4. Retornar Buffer
    // ExcelJS escreve um buffer, que transformamos em StreamableFile
    const buffer = await workbook.xlsx.writeBuffer();

    return new StreamableFile(Buffer.from(buffer), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="Relatorio_${classroom.code}.xlsx"`,
    });
  }

  // --- GERAÇÃO DE CSV (Mantido para retrocompatibilidade) ---
  async generateClassroomCSV(
    classroomId: string,
    requesterId: string,
  ): Promise<StreamableFile> {
    const { classroom, gradeMap } = await this.fetchReportData(
      classroomId,
      requesterId,
    );

    const stringifier = stringify({
      header: true,
      columns: [
        'Aluno ID',
        'Nome',
        'Email',
        ...classroom.problems.map((p) => `Prob: ${p.title} (Pts)`),
        ...classroom.problems.map((p) => `Status: ${p.title}`),
      ],
      bom: true,
      delimiter: ';',
    });

    (async () => {
      for (const student of classroom.students) {
        const displayName = student.name
          ? student.name
          : student.email.split('@')[0];
        const row: any = {
          'Aluno ID': student.id,
          Nome: displayName,
          Email: student.email,
        };

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

    return new StreamableFile(stringifier, {
      type: 'text/csv',
      disposition: `attachment; filename="Relatorio_${classroom.code}.csv"`,
    });
  }
}
