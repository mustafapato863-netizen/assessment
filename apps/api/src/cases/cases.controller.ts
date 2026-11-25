import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CloseCaseInput,
  CopilotBiasCheckInput,
  CopilotSuggestActionsInput,
  CopilotSynthesizeInput,
  CreateAttachmentInput,
  CreateCaseInput,
  DecideApprovalInput,
  EligibilityDecisionInput,
  feedbackVisibilitySchema,
  FinalizePlanInput,
  FinalizeResultInput,
  overrideRequestSchema,
  ReopenResultInput,
  reviseScorecardSchema,
  SaveEvidenceInput,
  ScheduleEventInput,
  ScheduleReassessmentInput,
  scorecardConfigSchema,
  scorecardSubmissionSchema,
  SubmitRecommendationInput,
  UpdateDevelopmentInput,
  updateAssessorRecommendationSchema,
  type AdminEditRequestInput,
  type AdminReopenStageInput,
  type UpdateEmployeeNameInput,
} from '@assessflow/contracts';
import { CasesService } from './cases.service';
import { CalibrationService } from './calibration.service';
import { CopilotService } from './copilot.service';
import { IdempotencyService } from '../common/idempotency.service';
import { Actor, AuthActor, getActorContext, Roles, ROUTE_PERMISSIONS } from '../auth';

@Controller('api/v1/assessflow')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly calibrationService: CalibrationService,
    private readonly copilotService: CopilotService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private resolveActor(actor?: AuthActor, fallbackActorId?: string): AuthActor {
    if (actor) return actor;
    const ctx = getActorContext();
    if (fallbackActorId && fallbackActorId !== 'demo-user' && ctx.id === 'demo-user') {
      return { ...ctx, id: fallbackActorId, name: fallbackActorId };
    }
    return ctx;
  }

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

  @Get('development-plans')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_GET)
  listDevelopmentPlans(@Actor() actor?: AuthActor) {
    return this.casesService.listDevelopmentPlans(this.resolveActor(actor));
  }

  @Get('assessor/assignments')
  @Roles('Assessor', 'PanelLead')
  listAssessorAssignments(@Actor() actor: AuthActor) {
    return this.casesService.listAssessorAssignments(actor.id, actor.email);
  }

  @Get('me/results')
  @Roles('Employee')
  listMyResults(@Actor() actor: AuthActor) {
    return this.casesService.listMyResults(actor);
  }

  @Get('cases')
  @Roles(...ROUTE_PERMISSIONS.CASE_LIST)
  async listCases(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;
    const page = await this.casesService.listPage({
      status,
      search,
      limit: Number.isFinite(parsedLimit) && (parsedLimit ?? 0) > 0 ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) && (parsedOffset ?? 0) > 0 ? parsedOffset : undefined,
    });
    // Body stays a plain array (backward compatible); the total is in a header.
    res.setHeader('X-Total-Count', String(page.total));
    return page.items;
  }

  @Post('cases')
  @Roles(...ROUTE_PERMISSIONS.CASE_CREATE)
  createCase(@Body() input: CreateCaseInput, @Actor() actor?: AuthActor) {
    return this.casesService.create(input, this.resolveActor(actor));
  }

  @Post('attachments')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_UPLOAD)
  createAttachment(
    @Body() input: CreateAttachmentInput,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.casesService.createAttachment(input, activeActor);
  }

  @Get('cases/:caseId/attachments')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_READ)
  listCaseAttachments(@Param('caseId') caseId: string) {
    return this.casesService.listAttachments(caseId);
  }

  @Get('attachments/clean/:attachmentId')
  @Roles(...ROUTE_PERMISSIONS.ATTACHMENT_READ)
  async streamCleanAttachment(
    @Param('attachmentId') attachmentId: string,
    @Query('mode') mode: string | undefined,
    @Res() res: Response,
    @Actor() actor?: AuthActor,
  ) {
    const file = await this.casesService.readCleanAttachmentFile(
      attachmentId,
      this.resolveActor(actor),
    );
    const disposition = mode === 'preview' ? 'inline' : 'attachment';
    const safeName = file.fileName.replace(/["\\\r\n]/g, '_');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
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

  @Post('cases/:caseId/stages/reopen')
  @Roles('Admin')
  reopenCompletedStage(
    @Param('caseId') caseId: string,
    @Body() input: AdminReopenStageInput,
    @Actor() actor: AuthActor,
  ) {
    return this.casesService.reopenCompletedStage(caseId, input, actor);
  }

  @Patch('cases/:caseId/request')
  @Roles('Admin')
  updateReopenedRequest(
    @Param('caseId') caseId: string,
    @Body() input: AdminEditRequestInput,
    @Actor() actor: AuthActor,
  ) {
    return this.casesService.updateReopenedRequest(caseId, input, actor);
  }

  @Patch('cases/:caseId/employee-name')
  @Roles('Admin')
  updateEmployeeName(
    @Param('caseId') caseId: string,
    @Body() input: UpdateEmployeeNameInput,
    @Actor() actor: AuthActor,
  ) {
    return this.casesService.updateEmployeeName(caseId, input, actor);
  }

  @Post('cases/:caseId/submit')
  @Roles(...ROUTE_PERMISSIONS.CASE_SUBMIT)
  submitCase(
    @Param('caseId') caseId: string,
    @Body('expectedVersion') expectedVersion: number,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `submit:${caseId}`,
      () => this.casesService.submit(caseId, Number(expectedVersion)),
      { expectedVersion: Number(expectedVersion) },
    );
  }

  @Post('cases/:caseId/eligibility/decision')
  @Roles(...ROUTE_PERMISSIONS.ELIGIBILITY_DECIDE)
  decideEligibility(
    @Param('caseId') caseId: string,
    @Body() input: EligibilityDecisionInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `eligibility-decision:${caseId}`,
      () => this.casesService.decideEligibility(caseId, input, activeActor),
      input,
    );
  }

  @Post('cases/:caseId/eligibility/override-request')
  @Roles(...ROUTE_PERMISSIONS.ELIGIBILITY_OVERRIDE)
  requestOverride(
    @Param('caseId') caseId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const parsed = overrideRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ??
          'An override reason of at least 5 characters is required.',
      );
    }
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `eligibility-override:${caseId}`,
      () => this.casesService.requestOverride(caseId, parsed.data.reason, activeActor),
      parsed.data,
    );
  }

  @Post('cases/:caseId/plan/finalize')
  @Roles(...ROUTE_PERMISSIONS.PLAN_FINALIZE)
  finalizePlan(
    @Param('caseId') caseId: string,
    @Body() input: FinalizePlanInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `plan-finalize:${caseId}`,
      () => this.casesService.finalizePlan(caseId, input),
      input,
    );
  }

  @Get('cases/:caseId/plan')
  @Roles(...ROUTE_PERMISSIONS.PLAN_GET)
  getPlan(@Param('caseId') caseId: string) {
    return this.casesService.getPlan(caseId);
  }

  @Get('cases/:caseId/scorecard')
  @Roles('Assessor', 'PanelLead', 'HR', 'Admin')
  getScorecard(@Param('caseId') caseId: string, @Actor() actor: AuthActor) {
    return this.casesService.getScorecard(caseId, actor);
  }

  @Patch('cases/:caseId/scorecard/config')
  @Roles('Assessor', 'Admin')
  updateScorecardConfig(
    @Param('caseId') caseId: string,
    @Body() input: unknown,
    @Actor() actor: AuthActor,
  ) {
    const parsed = scorecardConfigSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Invalid scorecard settings.');
    return this.casesService.updateScorecardConfig(caseId, parsed.data, actor);
  }

  @Post('cases/:caseId/scorecard')
  @Roles('Assessor', 'PanelLead', 'Admin')
  saveScorecard(
    @Param('caseId') caseId: string,
    @Body() input: unknown,
    @Actor() actor: AuthActor,
  ) {
    const parsed = scorecardSubmissionSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('Each question takes 0 up to its weight in points.');
    return this.casesService.saveScorecard(caseId, parsed.data.ratings, parsed.data.submit, actor);
  }

  @Post('cases/:caseId/scorecard/revise')
  @Roles('Assessor', 'PanelLead', 'Admin')
  reviseScorecard(
    @Param('caseId') caseId: string,
    @Body() input: unknown,
    @Actor() actor: AuthActor,
  ) {
    const parsed = reviseScorecardSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException('Enter a reason for editing the submitted scores.');
    }
    return this.casesService.reviseScorecard(caseId, parsed.data.reason, actor);
  }

  @Post('cases/:caseId/events')
  @Roles(...ROUTE_PERMISSIONS.EVENT_SCHEDULE)
  scheduleEvent(
    @Param('caseId') caseId: string,
    @Body() input: ScheduleEventInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `event-schedule:${caseId}`,
      () => this.casesService.scheduleEvent(caseId, input),
      input,
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
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.casesService.saveEvidence(eventId, activeActor, input, false);
  }

  @Post('events/:eventId/evidence/submit')
  @Roles(...ROUTE_PERMISSIONS.EVIDENCE_SUBMIT)
  submitEvidence(
    @Param('eventId') eventId: string,
    @Body() input: SaveEvidenceInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `evidence-submit:${eventId}`,
      () => this.casesService.saveEvidence(eventId, activeActor, input, true),
      input,
    );
  }

  @Post('cases/:caseId/result/finalize')
  @Roles(...ROUTE_PERMISSIONS.RESULT_FINALIZE)
  finalizeResult(
    @Param('caseId') caseId: string,
    @Body() input: FinalizeResultInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `result-finalize:${caseId}`,
      () => this.casesService.finalizeResult(caseId, input, activeActor),
      input,
    );
  }

  @Post('cases/:caseId/result/reopen')
  @Roles(...ROUTE_PERMISSIONS.RESULT_REOPEN)
  reopenResult(
    @Param('caseId') caseId: string,
    @Body() input: ReopenResultInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `result-reopen:${caseId}`,
      () => this.casesService.reopenResult(caseId, input, activeActor),
      input,
    );
  }

  @Patch('cases/:caseId/result/assessor-recommendation')
  @Roles('Assessor', 'Admin')
  updateAssessorRecommendation(
    @Param('caseId') caseId: string,
    @Body() input: unknown,
    @Actor() actor: AuthActor,
  ) {
    const parsed = updateAssessorRecommendationSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('Choose a recommendation and enter a reason for the change.');
    return this.casesService.updateAssessorRecommendation(caseId, parsed.data, actor);
  }

  @Get('cases/:caseId/result')
  @Roles(...ROUTE_PERMISSIONS.RESULT_GET)
  getResult(@Param('caseId') caseId: string, @Actor() actor: AuthActor) {
    return this.casesService.getResult(caseId, actor);
  }

  @Post('cases/:caseId/feedback-visibility')
  @Roles('Assessor', 'Admin')
  setFeedbackVisibility(
    @Param('caseId') caseId: string,
    @Body() body: unknown,
    @Actor() actor: AuthActor,
  ) {
    const parsed = feedbackVisibilitySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Specify visible: true or false.');
    }
    return this.casesService.setFeedbackVisibility(caseId, parsed.data.visible, actor);
  }

  @Post('cases/:caseId/recommendation')
  @Roles(...ROUTE_PERMISSIONS.RECOMMENDATION_SUBMIT)
  submitRecommendation(
    @Param('caseId') caseId: string,
    @Body() input: SubmitRecommendationInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `recommendation:${caseId}`,
      () => this.casesService.submitRecommendation(caseId, input, activeActor),
      input,
    );
  }

  @Get('cases/:caseId/recommendation')
  @Roles(...ROUTE_PERMISSIONS.RECOMMENDATION_GET)
  getRecommendation(@Param('caseId') caseId: string, @Actor() actor?: AuthActor) {
    return this.casesService.getRecommendation(caseId, this.resolveActor(actor));
  }

  @Post('approval-steps/:stepId/decision')
  @Roles(...ROUTE_PERMISSIONS.APPROVAL_DECIDE)
  decideApproval(
    @Param('stepId') stepId: string,
    @Body() input: DecideApprovalInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `approval:${stepId}`,
      () => this.casesService.decideApproval(stepId, input, activeActor),
      input,
    );
  }

  @Get('cases/:caseId/approval-steps')
  @Roles(...ROUTE_PERMISSIONS.APPROVAL_LIST)
  listApprovalSteps(@Param('caseId') caseId: string, @Actor() actor?: AuthActor) {
    return this.casesService.listApprovalSteps(caseId, this.resolveActor(actor));
  }

  @Post('cases/:caseId/development')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_UPDATE)
  updateDevelopment(
    @Param('caseId') caseId: string,
    @Body() input: UpdateDevelopmentInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `development:${caseId}`,
      () => this.casesService.updateDevelopment(caseId, input),
      input,
    );
  }

  @Get('cases/:caseId/development')
  @Roles(...ROUTE_PERMISSIONS.DEVELOPMENT_GET)
  getDevelopment(@Param('caseId') caseId: string, @Actor() actor?: AuthActor) {
    return this.casesService.getDevelopment(caseId, this.resolveActor(actor));
  }

  @Post('cases/:caseId/reassessment')
  @Roles(...ROUTE_PERMISSIONS.REASSESSMENT_SCHEDULE)
  scheduleReassessment(
    @Param('caseId') caseId: string,
    @Body() input: ScheduleReassessmentInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `reassessment:${caseId}`,
      () => this.casesService.scheduleReassessment(caseId, input),
      input,
    );
  }

  @Post('cases/:caseId/close')
  @Roles(...ROUTE_PERMISSIONS.CASE_CLOSE)
  closeCase(
    @Param('caseId') caseId: string,
    @Body() input: CloseCaseInput,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-actor-id') fallbackActorId?: string,
    @Actor() actor?: AuthActor,
  ) {
    const activeActor = this.resolveActor(actor, fallbackActorId);
    return this.idempotency.execute(
      idempotencyKey,
      activeActor.id,
      `close:${caseId}`,
      () => this.casesService.closeCase(caseId, input),
      input,
    );
  }

  @Get('calibration/matrix')
  @Roles('HR', 'Admin', 'Assessor', 'PanelLead', 'Manager', 'Auditor')
  getCalibrationMatrix(@Query('department') department?: string) {
    return this.calibrationService.getMatrix(department);
  }

  @Post('cases/:caseId/copilot/synthesize')
  @Roles(...ROUTE_PERMISSIONS.RESULT_FINALIZE)
  copilotSynthesize(@Param('caseId') caseId: string, @Body() input: CopilotSynthesizeInput) {
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
