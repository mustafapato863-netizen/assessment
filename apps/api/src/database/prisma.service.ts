import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@assessflow/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly enabled = process.env.DATA_MODE === 'database';

  async onModuleInit() {
    if (this.enabled) {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL data store.');
    }
  }

  async onModuleDestroy() {
    if (this.enabled) {
      await this.$disconnect();
    }
  }
}
