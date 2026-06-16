/**
 * AiModule
 *
 * Provides AiService globally so any module can inject it.
 * Sprint 9 (S9-002)
 */
import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';

@Global()
@Module({
  providers: [AiService],
  exports:   [AiService],
})
export class AiModule {}
