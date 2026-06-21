import { Module }             from '@nestjs/common';
import { ArtifactController } from './artifact.controller';
import { ArtifactService }    from './artifact.service';
import { EventBusModule }     from '../event-bus/event-bus.module';

@Module({
  imports:     [EventBusModule],
  controllers: [ArtifactController],
  providers:   [ArtifactService],
  exports:     [ArtifactService],
})
export class ArtifactModule {}
