import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import type { AuthUser } from './auth.types.js';
import { AuthService } from './auth.service.js';

type SyncUserFn = (userId: string, email: string) => Promise<unknown>;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { syncUser: jest.Mock<SyncUserFn> };

  const user: AuthUser = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'authenticated',
  };

  beforeEach(async () => {
    authService = { syncUser: jest.fn<SyncUserFn>() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getProfile returns req.user as-is', () => {
    expect(controller.getProfile({ user })).toEqual(user);
  });

  it('syncUser delegates to AuthService with userId and email', async () => {
    const synced = { user: { id: user.userId, email: user.email } };
    authService.syncUser.mockResolvedValue(synced);

    const result = await controller.syncUser({ user });

    expect(authService.syncUser).toHaveBeenCalledWith(user.userId, user.email);
    expect(result).toBe(synced);
  });
});
