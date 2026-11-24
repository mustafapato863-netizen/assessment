import {
  BadRequestException,
  Body,
  Controller,
  Ip,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { authLoginSchema, changePasswordSchema } from '@assessflow/contracts';
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
  async login(@Body() rawInput: unknown, @Ip() ip?: string) {
    const parsed = authLoginSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new UnauthorizedException('Enter your company email and password.');
    }
    const { email, password } = parsed.data;
    loginThrottle.assertAllowed(email, ip);
    try {
      const user = await this.accounts.authenticate(email, password);
      loginThrottle.recordSuccess(email);
      return { token: createAppToken(user), user };
    } catch (error) {
      if (error instanceof UnauthorizedException) loginThrottle.recordFailure(email, ip);
      throw error;
    }
  }

  @Post('change-password')
  @Roles(...APP_ROLES)
  async changePassword(@Body() rawInput: unknown, @Actor() actor: AuthActor, @Ip() ip?: string) {
    if (!actor.email) {
      throw new UnauthorizedException('Sign in with your company account to change the password.');
    }
    const parsed = changePasswordSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid password input.';
      throw new BadRequestException(firstError);
    }
    const { currentPassword, newPassword, confirmPassword } = parsed.data;

    loginThrottle.assertAllowed(actor.email, ip);
    try {
      await this.accounts.authenticate(actor.email, currentPassword);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        loginThrottle.recordFailure(actor.email, ip);
        throw new UnauthorizedException('Your current password is incorrect.');
      }
      throw error;
    }
    loginThrottle.recordSuccess(actor.email);
    const result = await this.accounts.changeTemporaryPassword(
      actor,
      newPassword,
      confirmPassword ?? newPassword,
    );
    const token = createAppToken({
      id: actor.id,
      name: actor.name,
      email: actor.email,
      roles: actor.roles,
      scopeType: actor.scopeType ?? 'ORGANIZATION',
      scopeValues: actor.scopeValues ?? [],
    });
    return { ...result, token };
  }
}
