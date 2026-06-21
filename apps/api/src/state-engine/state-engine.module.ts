import { Module } from '@nestjs/common';
import { StateEngineService } from './state-engine.service';
import { StateEngineController } from './state-engine.controller';

// EventBusModule is @Global() — no explicit import needed.
@Module({
  providers:   [StateEngineService],
  controllers: [StateEngineController],
  exports:     [StateEngineService],
})
export class StateEngineModule {}
