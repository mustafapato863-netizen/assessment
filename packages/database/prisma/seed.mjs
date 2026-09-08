import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

export async function seedDatabase(client = prisma) {
  console.log('[Seed] Upserting default organization...');
  const organization = await client.organization.upsert({
    where: { code: 'ASSESSFLOW-DEMO' },
    update: { name: 'AssessFlow Demo Company' },
    create: { code: 'ASSESSFLOW-DEMO', name: 'AssessFlow Demo Company' },
  });

  console.log('[Seed] Upserting reference employees...');
  const employeesData = [
    {
      externalId: 'emp-001',
      displayName: 'Mona Hassan',
      email: 'mona.hassan@example.test',
      department: 'Product',
      managerName: 'Sarah Johnson',
      currentRole: 'Senior Specialist',
      currentLevel: 'L4',
    },
    {
      externalId: 'emp-002',
      displayName: 'Omar Khalil',
      email: 'omar.khalil@example.test',
      department: 'Engineering',
      managerName: 'Sarah Johnson',
      currentRole: 'Software Engineer',
      currentLevel: 'L3',
    },
    {
      externalId: 'emp-003',
      displayName: 'Sara Adel',
      email: 'sara.adel@example.test',
      department: 'People',
      managerName: 'Sarah Johnson',
      currentRole: 'HR Specialist',
      currentLevel: 'L4',
    },
  ];

  const employees = [];
  for (const employee of employeesData) {
    const record = await client.employeeReference.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: employee.externalId,
        },
      },
      update: employee,
      create: { ...employee, organizationId: organization.id },
    });
    employees.push(record);
  }

  console.log('[Seed] Upserting retention policies...');
  const retentionPolicies = [
    { category: 'CASE_RECORD', retentionDays: null },
    { category: 'ASSESSOR_EVIDENCE', retentionDays: null },
    { category: 'EXPORT', retentionDays: 90 },
  ];

  for (const policy of retentionPolicies) {
    await client.retentionPolicy.upsert({
      where: { category: policy.category },
      update: policy,
      create: policy,
    });
  }

  // Check if cases already exist; if not, seed 3 initial demo cases
  const existingCasesCount = await client.assessmentCase.count({
    where: { organizationId: organization.id },
  });

  if (existingCasesCount === 0 && employees.length >= 3) {
    console.log('[Seed] Seeding initial demonstration assessment cases...');

    // Case 1: Mona Hassan - Pending Eligibility Review
    await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00124',
        organizationId: organization.id,
        employeeId: employees[0].id,
        assessmentReason: 'PROMOTION',
        stage: 'ELIGIBILITY',
        status: 'PENDING_ELIGIBILITY',
        ownerName: 'HR / Talent',
        priority: 'HIGH',
        currentRoleSnapshot: 'Senior Specialist',
        targetRoleSnapshot: 'Lead Specialist',
        targetLevelSnapshot: 'L5',
        departmentSnapshot: 'Product',
        justification: 'Promotion review for high performance during H2 cycle.',
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: null,
            criteria: {
              create: [
                {
                  criterionCode: 'TENURE',
                  label: 'Minimum time in current role',
                  blocking: true,
                  result: 'MET',
                },
                {
                  criterionCode: 'PIP',
                  label: 'Active PIP or disciplinary action',
                  blocking: true,
                  result: 'MET',
                },
                {
                  criterionCode: 'TRAINING',
                  label: 'Mandatory training',
                  blocking: false,
                  result: 'NOT_CHECKED',
                },
                {
                  criterionCode: 'POSITION',
                  label: 'Target position approved',
                  blocking: true,
                  result: 'MET',
                },
              ],
            },
          },
        },
        tasks: {
          create: [
            {
              taskType: 'REVIEW_ELIGIBILITY',
              assigneeId: 'demo-user',
              assigneeName: 'HR / Talent',
              status: 'OPEN',
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    // Case 2: Omar Khalil - Ready for Planning
    await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00123',
        organizationId: organization.id,
        employeeId: employees[1].id,
        assessmentReason: 'INTERNAL_MOBILITY',
        stage: 'PLANNING',
        status: 'READY_FOR_PLANNING',
        ownerName: 'Assessment Coordinator',
        priority: 'NORMAL',
        currentRoleSnapshot: 'Software Engineer',
        targetRoleSnapshot: 'Senior Software Engineer',
        targetLevelSnapshot: 'L4',
        departmentSnapshot: 'Engineering',
        justification: 'Internal mobility evaluation for backend infrastructure role.',
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: 'ELIGIBLE',
            decidedBy: 'Demo HR',
            decidedAt: new Date(),
            decisionReason: 'All prerequisite criteria fulfilled.',
            criteria: {
              create: [
                {
                  criterionCode: 'TENURE',
                  label: 'Minimum time in current role',
                  blocking: true,
                  result: 'MET',
                },
                {
                  criterionCode: 'PIP',
                  label: 'Active PIP or disciplinary action',
                  blocking: true,
                  result: 'MET',
                },
                {
                  criterionCode: 'TRAINING',
                  label: 'Mandatory training',
                  blocking: false,
                  result: 'MET',
                },
                {
                  criterionCode: 'POSITION',
                  label: 'Target position approved',
                  blocking: true,
                  result: 'MET',
                },
              ],
            },
          },
        },
        tasks: {
          create: [
            {
              taskType: 'FINALIZE_PLAN',
              assigneeId: 'demo-user',
              assigneeName: 'Assessment Coordinator',
              status: 'OPEN',
              dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    // Case 3: Sara Adel - Pending Approval
    await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00121',
        organizationId: organization.id,
        employeeId: employees[2].id,
        assessmentReason: 'ROLE_REALIGNMENT',
        stage: 'APPROVAL',
        status: 'PENDING_APPROVAL',
        ownerName: 'Business Approver',
        priority: 'NORMAL',
        currentRoleSnapshot: 'HR Specialist',
        targetRoleSnapshot: 'Senior People Partner',
        targetLevelSnapshot: 'L5',
        departmentSnapshot: 'People',
        justification: 'Align responsibilities with the emerging talent-partner operating model.',
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: 'ELIGIBLE',
            decidedBy: 'Demo HR',
            decidedAt: new Date(),
            decisionReason: 'Eligibility confirmed.',
          },
        },
        tasks: {
          create: [
            {
              taskType: 'DECIDE_APPROVAL',
              assigneeId: 'demo-user',
              assigneeName: 'Business Approver',
              status: 'OPEN',
              dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    console.log('[Seed] Successfully seeded 3 initial demonstration cases.');
  }

  console.log(`[Seed] Completed. Organization: ${organization.name}.`);
}

if (process.argv[1] && process.argv[1].endsWith('seed.mjs')) {
  seedDatabase()
    .catch((error) => {
      console.error('[Seed Error]', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
