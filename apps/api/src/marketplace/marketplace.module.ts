/**
 * MarketplaceModule — Phase 8
 *
 * Provides Marketplace and Org pack endpoints.
 * Imports PackModule (exports PackRegistryService + PackInstallerService).
 * SecurityModule is @Global() — injected automatically.
 */

import { Module } from '@nestjs/common';
import { PackModule }            from '../pack/pack.module';
import { MarketplaceController, OrgPackController } from './marketplace.controller';
import { RegistryController } from './registry.controller';
import { RegistryService } from './registry.service';

@Module({
  imports:     [PackModule],
  controllers: [MarketplaceController, OrgPackController, RegistryController],
  providers:   [RegistryService],
  exports:     [RegistryService],
})
export class MarketplaceModule {}
