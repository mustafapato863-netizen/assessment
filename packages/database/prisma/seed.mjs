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
    {
      externalId: 'emp-004',
      displayName: 'Laila Mansour',
      email: 'laila.mansour@example.test',
      department: 'Operations',
      managerName: 'Michael Brown',
      currentRole: 'Operations Specialist',
      currentLevel: 'L3',
    },
    {
      externalId: 'emp-005',
      displayName: 'Youssef Nabil',
      email: 'youssef.nabil@example.test',
      department: 'Engineering',
      managerName: 'Sarah Johnson',
      currentRole: 'Software Engineer',
      currentLevel: 'L3',
    },
    {
      externalId: 'emp-006',
      displayName: 'Huda Saleh',
      email: 'huda.saleh@example.test',
      department: 'Finance',
      managerName: 'Ahmed El Masry',
      currentRole: 'Financial Analyst',
      currentLevel: 'L3',
    },
    {
      externalId: 'emp-007',
      displayName: 'Karim Fathy',
      email: 'karim.fathy@example.test',
      department: 'Clinical Operations',
      managerName: 'Dr. Reem Hassan',
      currentRole: 'Clinical Coordinator',
      currentLevel: 'L4',
    },
    {
      externalId: 'emp-008',
      displayName: 'Reem Tarek',
      email: 'reem.tarek@example.test',
      department: 'Customer Experience',
      managerName: 'Mariam Saad',
      currentRole: 'Customer Experience Specialist',
      currentLevel: 'L3',
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

  // Check if cases already exist; if not, seed 3 initial demo cases.
  // These cases cover the first, middle, and approval stages of the workflow.
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

  // Additional cases cover the assessment, follow-up, and closed states so
  // every main screen has realistic data during local development.
  const assessmentCase = await client.assessmentCase.findUnique({
    where: { caseCode: 'AF-2026-00125' },
  });

  if (!assessmentCase) {
    const created = await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00125',
        organizationId: organization.id,
        employeeId: employees[3].id,
        assessmentReason: 'PROMOTION',
        stage: 'ASSESSMENT',
        status: 'IN_PROGRESS',
        ownerName: 'Assessment Coordinator',
        priority: 'HIGH',
        currentRoleSnapshot: 'Operations Specialist',
        targetRoleSnapshot: 'Operations Lead',
        targetLevelSnapshot: 'L4',
        managerSnapshot: 'Michael Brown',
        departmentSnapshot: 'Operations',
        justification: 'Promotion assessment for consistent operational leadership and delivery.',
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: 'ELIGIBLE',
            decidedBy: 'Demo HR',
            decidedAt: new Date(),
            decisionReason: 'All prerequisite criteria fulfilled.',
          },
        },
        plan: {
          create: {
            complexityBand: 'STANDARD',
            leadAssessor: 'Nadia Farouk',
            methods: {
              create: [
                {
                  methodCode: 'CBI',
                  methodLabel: 'Competency Based Interview',
                  required: true,
                  durationMin: 60,
                },
                {
                  methodCode: 'ROLEPLAY',
                  methodLabel: 'Operational Scenario Roleplay',
                  required: true,
                  durationMin: 45,
                },
              ],
            },
          },
        },
        tasks: {
          create: [
            {
              taskType: 'COMPLETE_ASSESSMENT',
              assigneeId: 'assessor-nadia',
              assigneeName: 'Nadia Farouk',
              status: 'OPEN',
              dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
      include: { plan: { include: { methods: true } } },
    });

    const method = created.plan?.methods[0];
    if (method) {
      const event = await client.assessmentEvent.create({
        data: {
          caseId: created.id,
          planMethodId: method.id,
          status: 'SCHEDULED',
          startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          timezone: 'Asia/Riyadh',
          location: 'Operations Meeting Room 2',
          assessors: {
            create: [{ userId: 'assessor-nadia', displayName: 'Nadia Farouk', role: 'Assessor' }],
          },
        },
      });

      await client.evidenceSubmission.create({
        data: {
          caseId: created.id,
          eventId: event.id,
          assessorId: 'assessor-nadia',
          assessorName: 'Nadia Farouk',
          summary: 'Assessment is scheduled; evidence will be submitted after the interview.',
        },
      });
    }
  }

  const followUpCase = await client.assessmentCase.findUnique({
    where: { caseCode: 'AF-2026-00126' },
  });

  if (!followUpCase) {
    const created = await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00126',
        organizationId: organization.id,
        employeeId: employees[4].id,
        assessmentReason: 'INTERNAL_MOBILITY',
        stage: 'FOLLOW_UP',
        status: 'DEVELOPMENT_IN_PROGRESS',
        ownerName: 'People Development',
        priority: 'NORMAL',
        currentRoleSnapshot: 'Software Engineer',
        targetRoleSnapshot: 'Senior Software Engineer',
        targetLevelSnapshot: 'L4',
        managerSnapshot: 'Sarah Johnson',
        departmentSnapshot: 'Engineering',
        justification: 'Development plan is active after a successful mobility assessment.',
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: 'ELIGIBLE',
            decidedBy: 'Demo HR',
            decidedAt: new Date(),
          },
        },
        resultRevisions: {
          create: {
            revision: 1,
            resultCode: 'READY_WITH_DEVELOPMENT',
            evidenceSummary: 'Strong technical performance with a development focus on stakeholder communication.',
            finalizedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            finalizedBy: 'assessor-nadia',
          },
        },
        recommendationRevisions: {
          create: {
            revision: 1,
            code: 'READY_WITH_DEVELOPMENT',
            status: 'APPROVED',
            rationale: 'Proceed with the target role after completing the communication development actions.',
            requiresDevelopment: true,
            requiresReassessment: false,
            submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            createdBy: 'hr-demo',
          },
        },
        approvalSteps: {
          create: [
            {
              sequence: 1,
              role: 'BusinessApprover',
              approverId: 'manager-sarah',
              approverName: 'Sarah Johnson',
              decision: 'APPROVED',
              decidedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
            },
          ],
        },
        developmentPlan: {
          create: {
            ownerName: 'Sarah Johnson',
            targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            status: 'IN_PROGRESS',
            actions: {
              create: [
                {
                  title: 'Lead a cross-team architecture review',
                  ownerName: 'Youssef Nabil',
                  dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
                  status: 'IN_PROGRESS',
                },
                {
                  title: 'Complete stakeholder communication workshop',
                  ownerName: 'Youssef Nabil',
                  dueDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
                  status: 'NOT_STARTED',
                },
              ],
            },
          },
        },
        tasks: {
          create: [
            {
              taskType: 'TRACK_DEVELOPMENT',
              assigneeId: 'manager-sarah',
              assigneeName: 'Sarah Johnson',
              status: 'OPEN',
              dueAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });

    await client.auditEvent.create({
      data: {
        caseId: created.id,
        actorId: 'hr-demo',
        actorName: 'Demo HR',
        action: 'DEVELOPMENT_STARTED',
        entityType: 'DevelopmentPlan',
        entityId: created.id,
        reason: 'Approved development actions started.',
        correlationId: 'seed-af-2026-00126',
      },
    });
  }

  const closedCase = await client.assessmentCase.findUnique({
    where: { caseCode: 'AF-2026-00127' },
  });

  if (!closedCase) {
    await client.assessmentCase.create({
      data: {
        caseCode: 'AF-2026-00127',
        organizationId: organization.id,
        employeeId: employees[0].id,
        assessmentReason: 'ROLE_REALIGNMENT',
        stage: 'CLOSED',
        status: 'CLOSED',
        ownerName: 'HR / Talent',
        priority: 'LOW',
        currentRoleSnapshot: 'Senior Specialist',
        targetRoleSnapshot: 'Principal Specialist',
        targetLevelSnapshot: 'L6',
        managerSnapshot: 'Sarah Johnson',
        departmentSnapshot: 'Product',
        justification: 'Completed role realignment review for the product operating model.',
        closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        eligibility: {
          create: {
            policyVersion: 'v2026.1',
            decision: 'ELIGIBLE',
            decidedBy: 'Demo HR',
            decidedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          },
        },
        resultRevisions: {
          create: {
            revision: 1,
            resultCode: 'READY_NOW',
            evidenceSummary: 'Demonstrated the required capability for the realigned specialist role.',
            finalizedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            finalizedBy: 'assessor-nadia',
          },
        },
        recommendationRevisions: {
          create: {
            revision: 1,
            code: 'READY_NOW',
            status: 'APPROVED',
            rationale: 'Ready for the realigned role with no additional development actions required.',
            requiresDevelopment: false,
            requiresReassessment: false,
            submittedAt: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
            createdBy: 'hr-demo',
          },
        },
        approvalSteps: {
          create: [
            {
              sequence: 1,
              role: 'BusinessApprover',
              approverId: 'manager-sarah',
              approverName: 'Sarah Johnson',
              decision: 'APPROVED',
              decidedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
            },
          ],
        },
      },
    });
  }

  // More workflow states for filters, dashboards, and negative-path testing.
  const extraCases = [
    {
      caseCode: 'AF-2026-00128',
      employee: employees[5],
      assessmentReason: 'PROMOTION',
      stage: 'REQUEST',
      status: 'DRAFT',
      ownerName: 'Huda Saleh',
      priority: 'HIGH',
      currentRoleSnapshot: 'Financial Analyst',
      targetRoleSnapshot: 'Senior Financial Analyst',
      targetLevelSnapshot: 'L4',
      managerSnapshot: 'Ahmed El Masry',
      departmentSnapshot: 'Finance',
      justification: 'Draft promotion request for strong forecasting and reporting performance.',
    },
    {
      caseCode: 'AF-2026-00129',
      employee: employees[6],
      assessmentReason: 'INTERNAL_MOBILITY',
      stage: 'ELIGIBILITY',
      status: 'NOT_ELIGIBLE',
      ownerName: 'HR / Talent',
      priority: 'NORMAL',
      currentRoleSnapshot: 'Clinical Coordinator',
      targetRoleSnapshot: 'Senior Clinical Coordinator',
      targetLevelSnapshot: 'L5',
      managerSnapshot: 'Dr. Reem Hassan',
      departmentSnapshot: 'Clinical Operations',
      justification: 'Mobility request paused until the mandatory clinical certification is complete.',
      eligibility: {
        create: {
          policyVersion: 'v2026.1',
          decision: 'NOT_ELIGIBLE',
          decidedBy: 'Demo HR',
          decidedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          decisionReason: 'Mandatory clinical certification is still outstanding.',
          criteria: {
            create: [
              {
                criterionCode: 'TENURE',
                label: 'Minimum time in current role',
                blocking: true,
                result: 'MET',
              },
              {
                criterionCode: 'TRAINING',
                label: 'Mandatory clinical certification',
                blocking: true,
                result: 'NOT_MET',
              },
            ],
          },
        },
      },
      tasks: {
        create: [
          {
            taskType: 'COMPLETE_TRAINING',
            assigneeId: 'manager-reem',
            assigneeName: 'Dr. Reem Hassan',
            status: 'OPEN',
            dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
    {
      caseCode: 'AF-2026-00130',
      employee: employees[7],
      assessmentReason: 'ROLE_REALIGNMENT',
      stage: 'RESULT',
      status: 'RESULT_FINALIZED',
      ownerName: 'Assessment Coordinator',
      priority: 'NORMAL',
      currentRoleSnapshot: 'Customer Experience Specialist',
      targetRoleSnapshot: 'Customer Experience Lead',
      targetLevelSnapshot: 'L4',
      managerSnapshot: 'Mariam Saad',
      departmentSnapshot: 'Customer Experience',
      justification: 'Role realignment review completed for the new customer journey team structure.',
      eligibility: {
        create: {
          policyVersion: 'v2026.1',
          decision: 'ELIGIBLE',
          decidedBy: 'Demo HR',
          decidedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        },
      },
      resultRevisions: {
        create: {
          revision: 1,
          resultCode: 'READY_NOW',
          evidenceSummary: 'Consistent customer outcomes and strong coaching behavior were demonstrated.',
          strengths: 'Customer advocacy and team coaching',
          gaps: 'Continue building reporting discipline',
          finalizedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          finalizedBy: 'assessor-nadia',
        },
      },
      tasks: {
        create: [
          {
            taskType: 'SUBMIT_RECOMMENDATION',
            assigneeId: 'hr-demo',
            assigneeName: 'Demo HR',
            status: 'OPEN',
            dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
    {
      caseCode: 'AF-2026-00131',
      employee: employees[5],
      assessmentReason: 'PROMOTION',
      stage: 'FOLLOW_UP',
      status: 'REASSESSMENT_DUE',
      ownerName: 'People Development',
      priority: 'HIGH',
      currentRoleSnapshot: 'Financial Analyst',
      targetRoleSnapshot: 'Finance Business Partner',
      targetLevelSnapshot: 'L5',
      managerSnapshot: 'Ahmed El Masry',
      departmentSnapshot: 'Finance',
      justification: 'Reassessment is due after completion of the financial partnering development plan.',
      eligibility: {
        create: {
          policyVersion: 'v2026.1',
          decision: 'ELIGIBLE',
          decidedBy: 'Demo HR',
          decidedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
        },
      },
      resultRevisions: {
        create: {
          revision: 1,
          resultCode: 'READY_WITH_DEVELOPMENT',
          evidenceSummary: 'Strong analytical capability with a reassessment required after development actions.',
          finalizedAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
          finalizedBy: 'assessor-nadia',
        },
      },
      recommendationRevisions: {
        create: {
          revision: 1,
          code: 'READY_WITH_DEVELOPMENT',
          status: 'APPROVED',
          rationale: 'Reassess after the business partnering development milestones are complete.',
          requiresDevelopment: true,
          requiresReassessment: true,
          targetDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          submittedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          createdBy: 'hr-demo',
        },
      },
      tasks: {
        create: [
          {
            taskType: 'SCHEDULE_REASSESSMENT',
            assigneeId: 'hr-demo',
            assigneeName: 'Demo HR',
            status: 'OPEN',
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  ];

  for (const extraCase of extraCases) {
    const existing = await client.assessmentCase.findUnique({
      where: { caseCode: extraCase.caseCode },
    });
    if (existing) continue;

    const { employee, ...caseData } = extraCase;
    await client.assessmentCase.create({
      data: {
        ...caseData,
        organizationId: organization.id,
        employeeId: employee.id,
      },
    });
  }

  const totalCases = await client.assessmentCase.count({
    where: { organizationId: organization.id },
  });
  console.log(
    `[Seed] Completed. Organization: ${organization.name}; ${employees.length} employees; ${totalCases} cases.`,
  );
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
