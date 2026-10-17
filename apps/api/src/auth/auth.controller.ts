import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AccessAccountsService } from '../access/access-accounts.service';
import { createAppToken } from './app-token.util';
import { Actor, AuthActor, Public, Roles } from './index';
import { APP_ROLES } from './auth.types';

@Controller('api/v1/assessflow/auth')
export class AuthController {
  constructor(private readonly accounts: AccessAccountsService) {}

  @Post('login')
  @Public()
  async login(@Body() input: { email?: string; password?: string }) {
    if (!input.email || !input.password) {
      throw new UnauthorizedException('Enter your company email and password.');
    }
    const user = await this.accounts.authenticate(input.email, input.password);
    return { token: createAppToken(user), user };
  }

  @Post('change-password')
  @Roles(...APP_ROLES)
  changePassword(
    @Body() input: { newPassword?: string; confirmPassword?: string },
    @Actor() actor: AuthActor,
  ) {
    return this.accounts.changeTemporaryPassword(
      actor,
      input.newPassword ?? '',
      input.confirmPassword ?? '',
    );
  }
}
