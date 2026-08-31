import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type { CreateCaseInput, EligibilityDecisionInput } from '@assessflow/contracts';
import { CasesService } from './cases.service';
import { IdempotencyService } from '../common/idempotency.service';

@Controller('api/v1/assessflow')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.casesService.getOverview();
  }

  @Get('tasks')
  getTasks() {
    return this.casesService.getTasks();
  }

  @Get('cases')
  listCases(@Query('status') status?: string, @Query('search') search?: string) {
    return this.casesService.list({ status, search });
  }

  @Post('cases')
  createCase(@Body() input: CreateCaseInput) {
    return this.casesService.create(input);
  }

  @Get('cases/:caseId')
  getCase(@Param('caseId') caseId: string) {
    return this.casesService.get(caseId);
  }

  @Post('cases/:caseId/submit')
  submitCase(
    @Param('caseId') caseId: string,
    @Body('expectedVersion') expectedVersion: number,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
  ) {
    return this.idempotency.execute(idempotencyKey, actorId, `submit:${caseId}`, () =>
      this.casesService.submit(caseId, Number(expectedVersion)),
    );
  }

  @Post('cases/:caseId/eligibility/decision')
  decideEligibility(
    @Param('caseId') caseId: string,
    @Body() input: EligibilityDecisionInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
  ) {
    return this.idempotency.execute(idempotencyKey, actorId, `eligibility-decision:${caseId}`, () =>
      this.casesService.decideEligibility(caseId, input),
    );
  }

  @Post('cases/:caseId/eligibility/override-request')
  requestOverride(
    @Param('caseId') caseId: string,
    @Body('reason') reason: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
  ) {
    return this.idempotency.execute(idempotencyKey, actorId, `eligibility-override:${caseId}`, () =>
      this.casesService.requestOverride(caseId, reason),
    );
  }
}
