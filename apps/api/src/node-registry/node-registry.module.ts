/**
 * NodeRegistryModule — Phase 1H
 *
 * Exposes GET /node-registry — structured node+pack registry for the canvas.
 * Imports NodeModule (NodeService) and PackModule (PackInstallerService).
 * Exports NodeRegistryService so OrganizationModule can call seedForOrg().
 */

import { Module } from '@nestjs/common';
import { NodeRegistryService }    from './node-registry.service';
import { NodeRegistryController } from './node-registry.controller';
import { NodeModule }             from '../node/node.module';
import { PackModule }             from '../pack/pack.module';

@Module({
  imports:     [NodeModule, PackModule],
  controllers: [NodeRegistryController],
  providers:   [NodeRegistryService],
  exports:     [NodeRegistryService],
})
export class NodeRegistryModule {}
