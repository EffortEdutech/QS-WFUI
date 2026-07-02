import { Module } from '@nestjs/common';
import { ResourceBindingsController } from './resource-bindings.controller';
import { ResourceBindingsService } from './resource-bindings.service';

@Module({
  controllers: [ResourceBindingsController],
  providers: [ResourceBindingsService],
  exports: [ResourceBindingsService],
})
export class ResourceBindingsModule {}
