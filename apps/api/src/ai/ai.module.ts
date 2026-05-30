import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AiController } from './ai.controller.js';
import { InternalAiController } from './internal-ai.controller.js';
import { AiService } from './ai.service.js';
import { AiQueueService } from './ai-queue.service.js';
import {
  WorkingMemoryService,
  REDIS_CLIENT,
} from './memory/working-memory.service.js';
import { EpisodicMemoryService } from './memory/episodic-memory.service.js';
import { SemanticMemoryService } from './memory/semantic-memory.service.js';
import { ProceduralMemoryService } from './memory/procedural-memory.service.js';
import { Layer1Service } from './layers/layer1.service.js';
import { Layer2Service } from './layers/layer2.service.js';
import { ExpertEngineService } from './expert/engine.service.js';
import { WorkerAiGuard } from './guards/worker-ai.guard.js';

@Module({
  imports: [ConfigModule],
  controllers: [AiController, InternalAiController],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const client = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
        client.on('error', (err: Error) => {
          console.error(`AI Redis error: ${err.message}`);
        });
        return client;
      },
    },
    AiService,
    AiQueueService,
    WorkerAiGuard,
    WorkingMemoryService,
    EpisodicMemoryService,
    SemanticMemoryService,
    ProceduralMemoryService,
    Layer1Service,
    Layer2Service,
    ExpertEngineService,
  ],
  exports: [AiQueueService, AiService],
})
export class AiModule {}
