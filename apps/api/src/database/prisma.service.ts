import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@assessflow/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly enabled = process.env.DATA_MODE === 'database';

  async onModuleInit() {
    if (this.enabled) await this.$connect();
  }

  async onModuleDestroy() {
    if (this.enabled) await this.$disconnect();
  }
}
