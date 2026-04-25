import { Test, TestingModule } from '@nestjs/testing';
import { InstagramController } from './instagram.controller.js';
import { InstagramService } from './instagram.service.js';

describe('InstagramController', () => {
  let controller: InstagramController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstagramController],
      providers: [
        { provide: InstagramService, useValue: {} },
      ],
    }).compile();

    controller = module.get<InstagramController>(InstagramController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});