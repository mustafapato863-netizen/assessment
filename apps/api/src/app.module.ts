import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CasesController } from './cases/cases.controller';
import { CasesService } from './cases/cases.service';
import { DatabaseModule } from './database/database.module';
import { IdempotencyService } from './common/idempotency.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, CasesController],
  providers: [CasesService, IdempotencyService],
})
export class AppModule {}
