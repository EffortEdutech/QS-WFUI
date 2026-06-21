import { Module } from '@nestjs/common';
import { PackRegistryService }  from './pack-registry.service';
import { PackInstallerService } from './pack-installer.service';
import { PackController }       from './pack.controller';

// SecurityModule is @Global() — no explicit import needed.

@Module({
  providers:   [PackRegistryService, PackInstallerService],
  controllers: [PackController],
  exports:     [PackRegistryService, PackInstallerService],
})
export class PackModule {}
