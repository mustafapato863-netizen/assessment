import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './auth';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'assessflow-api',
      dataMode: process.env.DATA_MODE ?? 'memory',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    if (!this.prisma.enabled) {
      return { status: 'ok', dataStore: 'memory', timestamp: new Date().toISOString() };
    }

    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', dataStore: 'postgresql', timestamp: new Date().toISOString() };
  }
}
