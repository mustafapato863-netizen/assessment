import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@assessflow/database';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly enabled = process.env.DATA_MODE === 'database';

  async onModuleInit() {
    if (this.enabled) {
      this.ensureDatabaseSchema();
      await this.$connect();
      await this.ensureSeedData();
    }
  }

  async onModuleDestroy() {
    if (this.enabled) await this.$disconnect();
  }

  private ensureDatabaseSchema() {
    try {
      this.logger.log('Synchronizing database schema with Prisma...');

      let prismaCli: string | undefined;
      try {
        prismaCli = require.resolve('prisma/build/index.js');
      } catch {
        const candidates = [
          resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'),
          resolve(process.cwd(), 'packages', 'database', 'node_modules', 'prisma', 'build', 'index.js'),
          resolve(__dirname, '..', '..', '..', 'node_modules', 'prisma', 'build', 'index.js'),
          resolve(__dirname, '..', '..', '..', 'packages', 'database', 'node_modules', 'prisma', 'build', 'index.js'),
        ];
        prismaCli = candidates.find((p) => existsSync(p));
      }

      if (!prismaCli || !existsSync(prismaCli)) {
        this.logger.warn('Prisma CLI executable not found; skipping automatic schema push.');
        return;
      }

      const schemaCandidates = [
        resolve(process.cwd(), 'packages', 'database', 'prisma', 'schema.prisma'),
        resolve(process.cwd(), 'prisma', 'schema.prisma'),
        resolve(__dirname, '..', '..', '..', 'packages', 'database', 'prisma', 'schema.prisma'),
      ];
      const schemaPath = schemaCandidates.find((p) => existsSync(p));

      if (!schemaPath) {
        this.logger.warn('schema.prisma not found; skipping automatic schema push.');
        return;
      }

      this.logger.log(`Executing Prisma push using schema: ${schemaPath}`);
      const result = spawnSync(
        process.execPath,
        [prismaCli, 'db', 'push', `--schema=${schemaPath}`, '--accept-data-loss'],
        {
          env: { ...process.env },
          stdio: 'inherit',
          timeout: 60000,
        },
      );

      if (result.status === 0) {
        this.logger.log('Prisma schema synchronized successfully.');
      } else {
        this.logger.warn(`Prisma db push exited with code ${result.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`Auto-push schema failed: ${err?.message}`);
    }
  }

  private async ensureSeedData() {
    try {
      let organization = await this.organization.findFirst({
        orderBy: { createdAt: 'asc' },
      });

      if (!organization) {
        this.logger.log('No organization found. Seeding default demo organization...');
        organization = await this.organization.upsert({
          where: { code: 'ASSESSFLOW-DEMO' },
          update: { name: 'AssessFlow Demo Company' },
          create: { code: 'ASSESSFLOW-DEMO', name: 'AssessFlow Demo Company' },
        });
      }

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

      const employees: Array<{ id: string }> = [];
      for (const emp of employeesData) {
        const record = await this.employeeReference.upsert({
          where: {
            organizationId_externalId: {
              organizationId: organization.id,
              externalId: emp.externalId,
            },
          },
          update: emp,
          create: { ...emp, organizationId: organization.id },
        });
        employees.push(record);
      }

      const retentionPolicies = [
        { category: 'CASE_RECORD' as const, retentionDays: null },
        { category: 'ASSESSOR_EVIDENCE' as const, retentionDays: null },
        { category: 'EXPORT' as const, retentionDays: 90 },
      ];

      for (const policy of retentionPolicies) {
        await this.retentionPolicy.upsert({
          where: { category: policy.category },
          update: policy,
          create: policy,
        });
      }

      const existingCasesCount = await this.assessmentCase.count({
        where: { organizationId: organization.id },
      });

      const [emp1, emp2, emp3] = employees;
      if (existingCasesCount === 0 && emp1 && emp2 && emp3) {
        this.logger.log('Seeding demonstration assessment cases...');

        // Case 1: Mona Hassan - Pending Eligibility Review
        await this.assessmentCase.create({
          data: {
            caseCode: 'AF-2026-00124',
            organizationId: organization.id,
            employeeId: emp1.id,
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
        await this.assessmentCase.create({
          data: {
            caseCode: 'AF-2026-00123',
            organizationId: organization.id,
            employeeId: emp2.id,
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
        await this.assessmentCase.create({
          data: {
            caseCode: 'AF-2026-00121',
            organizationId: organization.id,
            employeeId: emp3.id,
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

        this.logger.log('Seeded initial demo assessment cases successfully.');
      }
    } catch (err: any) {
      this.logger.warn(`Could not seed initial data: ${err?.message}`);
    }
  }
}
