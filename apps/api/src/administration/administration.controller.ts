import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccessAccountInput, AdminAccessAccountInput } from '../access/access-accounts.service';
import { Actor, AuthActor, Roles } from '../auth';
import { AdministrationService } from './administration.service';

@Controller('api/v1/assessflow/admin')
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get('accounts')
  @Roles('Admin')
  accounts() {
    return this.administration.listAccounts();
  }

  @Post('accounts')
  @Roles('Admin')
  createAccount(@Body() input: AdminAccessAccountInput, @Actor() actor: AuthActor) {
    return this.administration.createAccount(input, actor);
  }

  @Patch('accounts/:id')
  @Roles('Admin')
  updateAccount(
    @Param('id') id: string,
    @Body() input: Partial<AccessAccountInput>,
    @Actor() actor: AuthActor,
  ) {
    return this.administration.updateAccount(id, input, actor);
  }

  @Post('accounts/:id/deactivate')
  @Roles('Admin')
  deactivateAccount(@Param('id') id: string, @Actor() actor: AuthActor) {
    return this.administration.deactivateAccount(id, actor);
  }

  @Post('accounts/:id/reset-password')
  @Roles('Admin')
  resetPassword(@Param('id') id: string, @Actor() actor: AuthActor) {
    return this.administration.resetAccountPassword(id, actor);
  }

  @Get('policy')
  @Roles('Admin')
  policy() {
    return this.administration.getPolicy();
  }

  @Post('policy/enforce')
  @Roles('Admin')
  enforcePolicy(
    @Body()
    input: { policy?: import('./administration.service').AdministrationPolicy; reason?: string },
    @Actor() actor: AuthActor,
  ) {
    return this.administration.enforcePolicy(input, actor);
  }

  @Get('audit')
  @Roles('Admin')
  audit(
    @Query()
    query: {
      search?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    return this.administration.listAudit(query);
  }
}
