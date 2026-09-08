import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import type {
  CloseCaseInput,
  CopilotBiasCheckInput,
  CopilotSuggestActionsInput,
  CopilotSynthesizeInput,
  CreateAttachmentInput,
  CreateCaseInput,
  DecideApprovalInput,
  EligibilityDecisionInput,
  FinalizePlanInput,
  FinalizeResultInput,
  ReopenResultInput,
  SaveEvidenceInput,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
} from '@assessflow/contracts';
import { CasesService } from './cases.service';
import { CalibrationService } from './calibration.service';
import { CopilotService } from './copilot.service';
import { IdempotencyService } from '../common/idempotency.service';
import { Actor, AuthActor, Roles, ROUTE_PERMISSIONS, getActorContext } from '../auth';

@Controller('api/v1/assessflow')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly calibrationService: CalibrationService,
    private readonly copilotService: CopilotService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('overview')
  @Roles(...ROUTE_PERMISSIONS.OVERVIEW)
  getOverview() {
    return this.casesService.getOverview();
  }

  @Get('tasks')
  @Roles(...ROUTE_PERMISSIONS.TASKS)
  getTasks() {
    return this.casesService.getTasks();
  }

  @Get('cases')
  @Roles(...ROUTE_PERMISSIONS.CASE_LIST)
  listCases(@Query('status') status?: string, @Query('search') search?: string) {
    return this.casesService.list({ status, search });
  }

  @Post('cases')
  @Roles(...ROUTE_PERMISSIONS.CASE_CREATE)
  createCase(@Body() input: CreateCaseInput, @Actor() actor?: AuthActor) {
    const activeActor = this.actor(undefined, actor);
    return this.casesService.create(input, activeActor);
  }

  @Post('attachments')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD)
  createAttachment(
    @Body() input: CreateAttachmentInput,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.casesService.createAttachment(input, activeActor);
  }

  @Get('attachments/:attachmentId')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_READ)
  getAttachment(
    @Param('attachmentId') attachmentId: string,
    @Query('action') action?: string,
    @Query('download') download?: string,
  ) {
    if (action === 'download' || download === 'true') {
      return this.casesService.downloadAttachment(attachmentId);
    }
    if (action === 'preview') {
      return this.casesService.previewAttachment(attachmentId);
    }
    return this.casesService.getAttachment(attachmentId);
  }

  @Get('attachments/:attachmentId/preview')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_READ)
  previewAttachment(@Param('attachmentId') attachmentId: string) {
    return this.casesService.previewAttachment(attachmentId);
  }

  @Get('attachments/:attachmentId/download')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_READ)
  downloadAttachment(@Param('attachmentId') attachmentId: string) {
    return this.casesService.downloadAttachment(attachmentId);
  }

  @Get('cases/:caseId')
  @Roles(...ROUTE_PERMISSIONS.CASE_GET)
  getCase(@Param('caseId') caseId: string) {
    return this.casesService.get(caseId);
  }

  @Post('cases/:caseId/submit')
  @Roles(...ROUTE_PERMISSIONS.CASE_SUBMIT)
  submitCase(
    @Param('caseId') caseId: string,
    @Body('expectedVersion') expectedVersion: number,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `submit:${caseId}`, () =>
      this.casesService.submit(caseId, Number(expectedVersion)),
    );
  }

  @Post('cases/:caseId/eligibility/decision')
  @Roles(...ROUTE_PERMISSIONS.ELIGIBILITY_DECIDE)
  decideEligibility(
    @Param('caseId') caseId: string,
    @Body() input: EligibilityDecisionInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `eligibility-decision:${caseId}`,
      () => this.casesService.decideEligibility(caseId, input, activeActor),
    );
  }

  @Post('cases/:caseId/eligibility/override-request')
  @Roles(...ROUTE_PERMISSIONS.ELIGIBILITY_OVERRIDE)
  requestOverride(
    @Param('caseId') caseId: string,
    @Body('reason') reason: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `eligibility-override:${caseId}`,
      () => this.casesService.requestOverride(caseId, reason, activeActor),
    );
  }

  private actor(actorId?: string, actor?: AuthActor) {
    const ctx = actor ?? getActorContext();
    const id = actorId && actorId !== 'demo-user' ? actorId : ctx.id;
    const name = ctx.id === id ? ctx.name : (actorId ?? ctx.name);
    return { id, name };
  }

  @Post('cases/:caseId/plan/finalize')
  @Roles(...ROUTE_PERMISSIONS.PLAN_FINALIZE)
  finalizePlan(
    @Param('caseId') caseId: string,
    @Body() input: FinalizePlanInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `plan-finalize:${caseId}`, () =>
      this.casesService.finalizePlan(caseId, input),
    );
  }

  @Get('cases/:caseId/plan')
  @Roles(...ROUTE_PERMISSIONS.PLAN_GET)
  getPlan(@Param('caseId') caseId: string) {
    return this.casesService.getPlan(caseId);
  }

  @Post('cases/:caseId/events')
  @Roles(...ROUTE_PERMISSIONS.EVENT_SCHEDULE)
  scheduleEvent(
    @Param('caseId') caseId: string,
    @Body() input: ScheduleEventInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `event-schedule:${caseId}`,
      () => this.casesService.scheduleEvent(caseId, input),
    );
  }

  @Get('cases/:caseId/events')
  @Roles(...ROUTE_PERMISSIONS.EVENT_LIST)
  listEvents(@Param('caseId') caseId: string) {
    return this.casesService.listEvents(caseId);
  }

  @Post('events/:eventId/evidence')
  @Roles(...ROUTE_PERMISSIONS.EVIDENCE_SAVE)
  saveEvidence(
    @Param('eventId') eventId: string,
    @Body() input: SaveEvidenceInput,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.casesService.saveEvidence(eventId, activeActor, input, false);
  }

  @Post('events/:eventId/evidence/submit')
  @Roles(...ROUTE_PERMISSIONS.EVIDENCE_SUBMIT)
  submitEvidence(
    @Param('eventId') eventId: string,
    @Body() input: SaveEvidenceInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `evidence-submit:${eventId}`,
      () => this.casesService.saveEvidence(eventId, activeActor, input, true),
    );
  }

  @Post('cases/:caseId/result/finalize')
  @Roles(...ROUTE_PERMISSIONS.RESULT_FINALIZE)
  finalizeResult(
    @Param('caseId') caseId: string,
    @Body() input: FinalizeResultInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `result-finalize:${caseId}`,
      () => this.casesService.finalizeResult(caseId, input, activeActor),
    );
  }

  @Post('cases/:caseId/result/reopen')
  @Roles(...ROUTE_PERMISSIONS.RESULT_REOPEN)
  reopenResult(
    @Param('caseId') caseId: string,
    @Body() input: ReopenResultInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `result-reopen:${caseId}`, () =>
      this.casesService.reopenResult(caseId, input, activeActor),
    );
  }

  @Get('cases/:caseId/result')
  @Roles(...ROUTE_PERMISSIONS.RESULT_GET)
  getResult(@Param('caseId') caseId: string) {
    return this.casesService.getResult(caseId);
  }

  @Post('cases/:caseId/recommendation')
  @Roles(...ROUTE_PERMISSIONS.RECOMMENDATION_SUBMIT)
  submitRecommendation(
    @Param('caseId') caseId: string,
    @Body() input: SubmitRecommendationInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `recommendation:${caseId}`,
      () => this.casesService.submitRecommendation(caseId, input, activeActor),
    );
  }

  @Get('cases/:caseId/recommendation')
  @Roles(...ROUTE_PERMISSIONS.RECOMMENDATION_GET)
  getRecommendation(@Param('caseId') caseId: string) {
    return this.casesService.getRecommendation(caseId);
  }

  @Post('approval-steps/:stepId/decision')
  @Roles(...ROUTE_PERMISSIONS.APPROVAL_DECIDE)
  decideApproval(
    @Param('stepId') stepId: string,
    @Body() input: DecideApprovalInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `approval:${stepId}`, () =>
      this.casesService.decideApproval(stepId, input, activeActor),
    );
  }

  @Get('cases/:caseId/approval-steps')
  @Roles(...ROUTE_PERMISSIONS.APPROVAL_LIST)
  listApprovalSteps(@Param('caseId') caseId: string) {
    return this.casesService.listApprovalSteps(caseId);
  }

  @Post('cases/:caseId/development')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_UPDATE)
  updateDevelopment(
    @Param('caseId') caseId: string,
    @Body() input: UpdateDevelopmentInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `development:${caseId}`, () =>
      this.casesService.updateDevelopment(caseId, input),
    );
  }

  @Get('cases/:caseId/development')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_GET)
  getDevelopment(@Param('caseId') caseId: string) {
    return this.casesService.getDevelopment(caseId);
  }

  @Post('cases/:caseId/reassessment')
  @Roles(...ROUTE_PERMISSIONS.REASSESSMENT_SCHEDULE)
  scheduleReassessment(
    @Param('caseId') caseId: string,
    @Body() input: ScheduleReassessmentInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `reassessment:${caseId}`, () =>
      this.casesService.scheduleReassessment(caseId, input),
    );
  }

  @Post('cases/:caseId/close')
  @Roles(...ROUTE_PERMISSIONS.CASE_CLOSE)
  closeCase(
    @Param('caseId') caseId: string,
    @Body() input: CloseCaseInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') actorId = 'demo-user',
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.actor(actorId, actor);
    return this.idempotency.execute(idempotencyKey, activeActor.id, `close:${caseId}`, () =>
      this.casesService.closeCase(caseId, input),
    );
  }

  @Get('calibration/matrix')
  @Roles(...ROUTE_PERMISSIONS.OVERVIEW)
  getCalibrationMatrix(@Query('department') department?: string) {
    return this.calibrationService.getMatrix(department);
  }

  @Post('cases/:caseId/copilot/synthesize')
  @Roles(...ROUTE_PERMISSIONS.RESULT_FINALIZE)
  copilotSynthesize(
    @Param('caseId') caseId: string,
    @Body() input: CopilotSynthesizeInput,
  ) {
    return this.copilotService.synthesize(caseId, input);
  }

  @Post('cases/:caseId/copilot/bias-check')
  @Roles(...ROUTE_PERMISSIONS.EVIDENCE_SAVE)
  copilotBiasCheck(@Body() input: CopilotBiasCheckInput) {
    return this.copilotService.checkBias(input);
  }

  @Post('cases/:caseId/copilot/suggest-actions')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_UPDATE)
  copilotSuggestActions(
    @Param('caseId') caseId: string,
    @Body() input: CopilotSuggestActionsInput,
  ) {
    return this.copilotService.suggestActions(caseId, input);
  }
}
