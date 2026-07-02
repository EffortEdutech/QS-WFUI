import { Module } from '@nestjs/common';
import { DataPacksController, OrgDataPacksController, DataPackItemsController } from './data-packs.controller';
import { DataPacksService } from './data-packs.service';

@Module({
  controllers: [DataPacksController, OrgDataPacksController, DataPackItemsController],
  providers: [DataPacksService],
  exports: [DataPacksService],
})
export class DataPacksModule {}
