import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { EventBusController } from './event-bus.controller';

/**
 * @Global() — EventBusService is available throughout the app without
 * each module importing EventBusModule explicitly. This avoids circular
 * dependencies when Resource, Approval, and Execution modules publish events.
 */
@Global()
@Module({
  providers:   [EventBusService],
  controllers: [EventBusController],
  exports:     [EventBusService],
})
export class EventBusModule {}
