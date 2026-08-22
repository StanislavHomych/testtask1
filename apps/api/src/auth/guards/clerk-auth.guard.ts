import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth.types';

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedUser;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await verifyToken(token, {
        secretKey: this.config.getOrThrow<string>('CLERK_SECRET_KEY'),
        authorizedParties: [this.config.getOrThrow<string>('FRONTEND_URL')],
      });

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid session');
      }

      request.auth = {
        clerkUserId: payload.sub,
        sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
