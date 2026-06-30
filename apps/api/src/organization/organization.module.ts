import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService }    from './organization.service';
import { NodeRegistryModule }     from '../node-registry/node-registry.module';

@Module({
  imports:     [NodeRegistryModule],  // Phase 1H -- seedForOrg() on org creation
  controllers: [OrganizationController],
  providers:   [OrganizationService],
  exports:     [OrganizationService],
})
export class OrganizationModule {}
