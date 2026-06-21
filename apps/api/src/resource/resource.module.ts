import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { StateEngineModule } from '../state-engine/state-engine.module';

@Module({
  imports:     [StateEngineModule],
  providers:   [ResourceService],
  controllers: [ResourceController],
  exports:     [ResourceService],
})
export class ResourceModule {}
