jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {
    $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, PrismaService],
    }).compile();

    appController = app.get<AppController>(AppController);
    prisma = app.get(PrismaService);
  });

  describe('root', () => {
    it('should return API info', () => {
      expect(appController.getInfo()).toEqual({
        name: 'Vault API',
        status: 'ok',
        docs: '/api/docs',
      });
    });
  });

  describe('health', () => {
    it('should report database up', async () => {
      await expect(appController.getHealth()).resolves.toMatchObject({
        status: 'ok',
        database: 'up',
      });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
