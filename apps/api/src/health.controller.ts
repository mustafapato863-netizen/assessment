import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './auth';

@Public()
@Controller(['health', 'api/v1/assessflow/health', ''])
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'assessflow-api',
      version: process.env.npm_package_version ?? '0.3.0',
      dataMode: process.env.DATA_MODE ?? 'memory',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    if (!this.prisma.enabled) {
      return {
        status: 'ok',
        service: 'assessflow-api',
        version: process.env.npm_package_version ?? '0.3.0',
        dataStore: 'memory',
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const startedAt = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database readiness timeout')), 3000),
        ),
      ]);
      return {
        status: 'ok',
        service: 'assessflow-api',
        version: process.env.npm_package_version ?? '0.3.0',
        dataStore: 'postgresql',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Database readiness check failed.');
    }
  }
}
