import { PrismaClient } from '../generated/client/index.js';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { code: 'ASSESSFLOW-DEMO' },
    update: { name: 'AssessFlow Demo Company' },
    create: { code: 'ASSESSFLOW-DEMO', name: 'AssessFlow Demo Company' },
  });

  const employees = [
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

  for (const employee of employees) {
    await prisma.employeeReference.upsert({
      where: {
        organizationId_externalId: {
          organizationId: organization.id,
          externalId: employee.externalId,
        },
      },
      update: employee,
      create: { ...employee, organizationId: organization.id },
    });
  }

  const retentionPolicies = [
    { category: 'CASE_RECORD', retentionDays: null },
    { category: 'ASSESSOR_EVIDENCE', retentionDays: null },
    { category: 'EXPORT', retentionDays: 90 },
  ];

  for (const policy of retentionPolicies) {
    await prisma.retentionPolicy.upsert({
      where: { category: policy.category },
      update: policy,
      create: policy,
    });
  }

  console.log(`Seeded ${organization.name} with ${employees.length} reference employees.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
