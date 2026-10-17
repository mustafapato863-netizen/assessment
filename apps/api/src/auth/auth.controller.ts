import {
  BadRequestException,
  Body,
  Controller,
  Ip,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessAccountsService } from '../access/access-accounts.service';
import { createAppToken } from './app-token.util';
import { Actor, AuthActor, Public, Roles } from './index';
import { APP_ROLES } from './auth.types';
import { loginThrottle } from './login-throttle';

@Controller('api/v1/assessflow/auth')
export class AuthController {
  constructor(private readonly accounts: AccessAccountsService) {}

  @Post('login')
  @Public()
  async login(@Body() input: { email?: string; password?: string }, @Ip() ip?: string) {
    if (!input.email || !input.password) {
      throw new UnauthorizedException('Enter your company email and password.');
    }
    loginThrottle.assertAllowed(input.email, ip);
    try {
      const user = await this.accounts.authenticate(input.email, input.password);
      loginThrottle.recordSuccess(input.email);
      return { token: createAppToken(user), user };
    } catch (error) {
      if (error instanceof UnauthorizedException) loginThrottle.recordFailure(input.email, ip);
      throw error;
    }
  }

  @Post('change-password')
  @Roles(...APP_ROLES)
  async changePassword(
    @Body() input: { currentPassword?: string; newPassword?: string; confirmPassword?: string },
    @Actor() actor: AuthActor,
    @Ip() ip?: string,
  ) {
    // Re-authenticate so a stolen session token alone cannot take over the account.
    if (!actor.email) {
      throw new UnauthorizedException('Sign in with your company account to change the password.');
    }
    if (!input.currentPassword) {
      throw new BadRequestException('Enter your current password.');
    }
    if (input.newPassword && input.newPassword === input.currentPassword) {
      throw new BadRequestException('Choose a new password that differs from the current one.');
    }
    loginThrottle.assertAllowed(actor.email, ip);
    try {
      await this.accounts.authenticate(actor.email, input.currentPassword);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        loginThrottle.recordFailure(actor.email, ip);
        throw new UnauthorizedException('Your current password is incorrect.');
      }
      throw error;
    }
    loginThrottle.recordSuccess(actor.email);
    return this.accounts.changeTemporaryPassword(
      actor,
      input.newPassword ?? '',
      input.confirmPassword ?? '',
    );
  }
}
