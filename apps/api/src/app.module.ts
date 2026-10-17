import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CasesController } from './cases/cases.controller';
import { CasesService } from './cases/cases.service';
import { CalibrationService } from './cases/calibration.service';
import { CopilotService } from './cases/copilot.service';
import { DatabaseModule } from './database/database.module';
import { IdempotencyService } from './common/idempotency.service';
import { AuthModule } from './auth';
import { AccessAccountsController } from './access/access-accounts.controller';
import { AccessAccountsService } from './access/access-accounts.service';
import { AuthController } from './auth/auth.controller';
import { AdministrationController } from './administration/administration.controller';
import { AdministrationService } from './administration/administration.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    HealthController,
    CasesController,
    AccessAccountsController,
    AuthController,
    AdministrationController,
  ],
  providers: [
    CasesService,
    CalibrationService,
    CopilotService,
    IdempotencyService,
    AccessAccountsService,
    AdministrationService,
  ],
})
export class AppModule {}
