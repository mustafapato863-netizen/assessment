import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { CreateCaseInput } from '@assessflow/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AuthActor } from '../auth/auth.types';
import { PrismaCasesRepository } from './prisma-cases.repository';

type Row = Record<string, any>;

// A small in-memory stand-in for the Prisma calls the repository makes. It applies
// updates the way Prisma does, so assertions on stored rows test real behaviour.
function createFakeDatabase(seed: { employees?: Row[]; cases?: Row[] } = {}) {
  const organization = { id: 'org-1', code: 'ASSESSFLOW-DEMO', createdAt: new Date(0) };
  const employees: Row[] = [...(seed.employees ?? [])];
  const cases: Row[] = [...(seed.cases ?? [])];
  const audits: Row[] = [];
  let sequence = 0;

  const findEmployee = (key: { organizationId: string; externalId: string }) =>
    employees.find(
      (row) => row.organizationId === key.organizationId && row.externalId === key.externalId,
    );

  const database: Row = {
    organization: { findFirst: async () => organization },
    employeeReference: {
      findUnique: async ({ where }: Row) => findEmployee(where.organizationId_externalId) ?? null,
      upsert: async ({ where, update, create }: Row) => {
        const existing = findEmployee(where.organizationId_externalId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `employee-${++sequence}`, ...create };
        employees.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => {
        const row = employees.find((item) => item.id === where.id);
        if (!row) throw new Error(`No employee ${where.id}`);
        Object.assign(row, data);
        return row;
      },
    },
    assessmentCase: {
      findUnique: async ({ where, include }: Row) => {
        const row = cases.find((item) => item.id === where.id);
        if (!row) return null;
        return include?.employee
          ? { ...row, employee: employees.find((item) => item.id === row.employeeId) }
          : row;
      },
      findMany: async ({ where }: Row) =>
        cases.filter((row) => row.employeeId === where.employeeId).map((row) => ({ id: row.id })),
      create: async ({ data }: Row) => {
        const row = { id: `case-${++sequence}`, ...data };
        cases.push(row);
        return row;
      },
    },
    auditEvent: {
      create: async ({ data }: Row) => {
        audits.push(data);
        return data;
      },
      createMany: async ({ data }: Row) => {
        audits.push(...data);
        return { count: data.length };
      },
    },
    $transaction: async (callback: (tx: Row) => unknown) => callback(database),
  };

  return { database, employees, cases, audits };
}

const admin: AuthActor = { id: 'admin-1', name: 'Admin One', roles: ['Admin'] };
const hrUser: AuthActor = { id: 'hr-1', name: 'HR One', roles: ['HR'] };

const existingEmployee = {
  id: 'employee-1',
  organizationId: 'org-1',
  externalId: '10452',
  displayName: 'Mahmoud ElRawy',
  email: null,
  department: 'RCM',
  currentRole: 'RCM Manager',
  currentLevel: 'L5',
  employmentState: 'ACTIVE',
};

const linkedCases = [
  { id: 'case-a', employeeId: 'employee-1' },
  { id: 'case-b', employeeId: 'employee-1' },
];

const internalRequest: CreateCaseInput = {
  candidateType: 'INTERNAL_EMPLOYEE',
  employeeId: '10452',
  employeeName: 'Mahmoud ElRawy',
  department: 'RCM',
  currentRole: 'RCM Manager',
  currentLevel: 'L5',
  assessmentReason: 'PROMOTION',
  targetRole: 'RCM Director',
  targetLevel: 'L6',
  justification: 'Ready to take on the wider RCM scope this cycle.',
  priority: 'NORMAL',
};

function createRepository(database: Row) {
  const repository = new PrismaCasesRepository(database as never);
  // The read-back maps the stored graph to the API shape; these tests check the writes.
  vi.spyOn(repository, 'get').mockResolvedValue({} as never);
  return repository;
}

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to be refused');
}

const errorCodeOf = (error: unknown) =>
  (error as { getResponse(): { error: { code: string } } }).getResponse().error.code;

describe('PrismaCasesRepository.updateEmployeeName', () => {
  it('lets an Admin correct the name and records it on every linked case', async () => {
    const { database, employees, audits } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
      cases: linkedCases,
    });
    const repository = createRepository(database);

    await repository.updateEmployeeName(
      'case-a',
      { displayName: 'Mahmoud El-Rawy', reason: 'Corrected spelling from HR records' },
      admin,
    );

    expect(employees[0]?.displayName).toBe('Mahmoud El-Rawy');
    const corrections = audits.filter((item) => item.action === 'EMPLOYEE_NAME_CORRECTED');
    expect(corrections.map((item) => item.caseId).sort()).toEqual(['case-a', 'case-b']);
    expect(corrections[0]).toMatchObject({
      actorId: 'admin-1',
      entityType: 'EmployeeReference',
      entityId: 'employee-1',
      reason: 'Corrected spelling from HR records',
      previousData: { displayName: 'Mahmoud ElRawy' },
      newData: { displayName: 'Mahmoud El-Rawy' },
    });
  });

  it('refuses a non-Admin with ADMIN_REQUIRED and changes nothing', async () => {
    const { database, employees, audits } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
      cases: linkedCases,
    });
    const repository = createRepository(database);

    const error = await rejectionOf(
      repository.updateEmployeeName(
        'case-a',
        { displayName: 'Mahmoud El-Rawy', reason: 'Corrected spelling from HR records' },
        hrUser,
      ),
    );

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(errorCodeOf(error)).toBe('ADMIN_REQUIRED');
    expect(employees[0]?.displayName).toBe('Mahmoud ElRawy');
    expect(audits).toHaveLength(0);
  });

  it('refuses a reason shorter than 10 characters and changes nothing', async () => {
    const { database, employees, audits } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
      cases: linkedCases,
    });
    const repository = createRepository(database);

    const error = await rejectionOf(
      repository.updateEmployeeName(
        'case-a',
        { displayName: 'Mahmoud El-Rawy', reason: 'Too short' },
        admin,
      ),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(errorCodeOf(error)).toBe('VALIDATION_ERROR');
    expect(employees[0]?.displayName).toBe('Mahmoud ElRawy');
    expect(audits).toHaveLength(0);
  });

  it('writes no audit when the name is unchanged', async () => {
    const { database, employees, audits } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
      cases: linkedCases,
    });
    const repository = createRepository(database);

    await repository.updateEmployeeName(
      'case-a',
      { displayName: 'Mahmoud ElRawy', reason: 'Confirmed the name is already correct' },
      admin,
    );

    expect(employees[0]?.displayName).toBe('Mahmoud ElRawy');
    expect(audits).toHaveLength(0);
  });
});

describe('PrismaCasesRepository.create with an employee staff number', () => {
  it('creates the employee and the case in one go for a new staff number', async () => {
    const { database, employees, cases, audits } = createFakeDatabase();
    const repository = createRepository(database);

    await repository.create(internalRequest, admin);

    expect(employees).toHaveLength(1);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.employeeId).toBe(employees[0]?.id);
    expect(audits.map((item) => item.action)).toEqual(['CASE_CREATED']);
  });

  it('refuses a staff number already registered to a different name', async () => {
    const { database, employees, cases, audits } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
    });
    const repository = createRepository(database);

    const error = await rejectionOf(
      repository.create({ ...internalRequest, employeeName: 'Someone Else' }, admin),
    );

    expect(error).toBeInstanceOf(BadRequestException);
    expect(errorCodeOf(error)).toBe('EMPLOYEE_ID_NAME_MISMATCH');
    expect(employees).toHaveLength(1);
    expect(employees[0]?.displayName).toBe('Mahmoud ElRawy');
    expect(cases).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('accepts the same name with different spacing and case, linked to the same record', async () => {
    const { database, employees, cases } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
    });
    const repository = createRepository(database);

    await repository.create({ ...internalRequest, employeeName: '  mahmoud   elrawy ' }, admin);

    expect(employees).toHaveLength(1);
    expect(employees[0]?.displayName).toBe('Mahmoud ElRawy');
    expect(cases).toHaveLength(1);
    expect(cases[0]?.employeeId).toBe('employee-1');
  });

  it('does not overwrite an existing employee record from a new request', async () => {
    const { database, employees, cases } = createFakeDatabase({
      employees: [{ ...existingEmployee }],
    });
    const repository = createRepository(database);

    await repository.create(
      {
        ...internalRequest,
        department: 'Finance',
        currentRole: 'Finance Lead',
        currentLevel: 'L4',
        candidateEmail: 'new.address@example.com',
      },
      admin,
    );

    expect(employees).toHaveLength(1);
    expect(employees[0]).toMatchObject({
      displayName: 'Mahmoud ElRawy',
      department: 'RCM',
      currentRole: 'RCM Manager',
      currentLevel: 'L5',
      email: null,
    });
    // The request's own values stay on the new case, so older cases keep theirs.
    expect(cases[0]).toMatchObject({
      departmentSnapshot: 'Finance',
      currentRoleSnapshot: 'Finance Lead',
    });
  });
});
