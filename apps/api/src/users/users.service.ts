import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CurrentUserResponse {
  id: string;
  clerkUserId: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  private readonly clerk;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.clerk = createClerkClient({
      secretKey: config.getOrThrow<string>('CLERK_SECRET_KEY'),
    });
  }

  async ensureLocalUser(clerkUserId: string): Promise<CurrentUserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existing) {
      return this.toResponse(existing);
    }

    const clerkUser = await this.clerk.users.getUser(clerkUserId);
    const email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      throw new BadRequestException(
        'Clerk user does not have an email address',
      );
    }

    try {
      const user = await this.prisma.user.upsert({
        where: { clerkUserId },
        update: { email },
        create: { clerkUserId, email },
      });
      return this.toResponse(user);
    } catch {
      throw new InternalServerErrorException('Could not persist local user');
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: 'insensitive',
        },
      },
    });
  }

  private toResponse(user: User): CurrentUserResponse {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
