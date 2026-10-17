import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AccessAccountsService, type AccessAccountInput } from './access-accounts.service';
import { Actor, AuthActor, Roles } from '../auth';

@Controller('api/v1/assessflow/access/accounts')
export class AccessAccountsController {
  constructor(private readonly accessAccounts: AccessAccountsService) {}

  @Get()
  @Roles('Admin')
  list(@Actor() actor: AuthActor) {
    return this.accessAccounts.list(actor);
  }

  @Get('assessor-options')
  @Roles('Coordinator', 'HR', 'Admin', 'Assessor')
  listAssessors() {
    return this.accessAccounts.listAssessors();
  }

  @Post()
  @Roles('Admin')
  create(@Body() input: AccessAccountInput, @Actor() actor: AuthActor) {
    return this.accessAccounts.create(input, actor);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id') id: string,
    @Body() input: Partial<AccessAccountInput>,
    @Actor() actor: AuthActor,
  ) {
    return this.accessAccounts.update(id, input, actor);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@Param('id') id: string, @Actor() actor: AuthActor) {
    return this.accessAccounts.remove(id, actor);
  }
}
