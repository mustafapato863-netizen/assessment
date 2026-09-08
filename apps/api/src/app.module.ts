import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CasesController } from './cases/cases.controller';
import { CasesService } from './cases/cases.service';
import { CalibrationService } from './cases/calibration.service';
import { CopilotService } from './cases/copilot.service';
import { DatabaseModule } from './database/database.module';
import { IdempotencyService } from './common/idempotency.service';
import { AuthModule } from './auth';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, CasesController],
  providers: [CasesService, CalibrationService, CopilotService, IdempotencyService],
})
export class AppModule {}
