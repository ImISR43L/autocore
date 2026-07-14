import { DataSource } from 'typeorm';
import { Classroom } from '../../classrooms/entities/classroom.entity';
import { User } from '../../users/entities/user.entity';
import { SubjectType } from '../../common/enums/subject-type.enum';
import { seedSqlExample } from './seed-sql-example';
import { seedSqlModelingExample } from './seed-sql-modeling-example';

function randomJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Cria uma turma de SQL do zero e já popula o exercício de exemplo
 * ("Clientes com pedidos") dentro dela, reaproveitando seedSqlExample —
 * não duplica a lógica de criação do Problem/TestCase.
 *
 * ASSUNÇÃO: não tenho classroom.entity.ts. Campos usados abaixo (name,
 * code, subject, owner, students) foram inferidos do que já apareceu
 * referenciado em problem.entity.ts e submissions.service.ts. Se
 * ClassroomsService tiver validação própria (código de convite único,
 * etc.) que este insert direto pule, ajuste conforme necessário.
 */
export async function seedSqlClassroom(
  dataSource: DataSource,
  teacherId: string,
  studentId?: string,
) {
  const classroomRepo = dataSource.getRepository(Classroom);
  const userRepo = dataSource.getRepository(User);

  const teacher = await userRepo.findOne({ where: { id: teacherId } as any });
  if (!teacher) {
    throw new Error(`Professor ${teacherId} não encontrado.`);
  }

  const classroom = classroomRepo.create({
    name: 'Turma de SQL (seed)',
    code: randomJoinCode(),
    subject: SubjectType.SQL,
    owner: teacher,
    students: [],
  } as any);

  const savedClassroom = await classroomRepo.save(classroom as any);

  if (studentId) {
    const student = await userRepo.findOne({ where: { id: studentId } as any });
    if (student) {
      (savedClassroom as any).students = [student];
      await classroomRepo.save(savedClassroom as any);
    } else {
      console.warn(
        `Aluno ${studentId} não encontrado — turma criada sem matrícula.`,
      );
    }
  }

  // Duas atividades na mesma turma, subjects diferentes por problema —
  // é exatamente o cenário que o seletor em CreateProblem.tsx existe pra
  // viabilizar (turma fica "SQL", cada atividade escolhe seu tipo).
  const sqlProblem = await seedSqlExample(
    dataSource,
    (savedClassroom as any).id,
  );
  const sqlModelingProblem = await seedSqlModelingExample(
    dataSource,
    (savedClassroom as any).id,
  );

  return {
    classroom: savedClassroom,
    sqlProblem,
    sqlModelingProblem,
  };
}
