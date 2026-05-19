import { Test, TestingModule } from '@nestjs/testing';
import { InstagramService } from './instagram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('InstagramService', () => {
  let service: InstagramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InstagramService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
