import { Global, Module } from '@nestjs/common';
import { SecurityEngineService } from './security.service';
import { SecurityController } from './security.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyController } from './api-key.controller';

/**
 * @Global() — SecurityEngineService and ApiKeyService are available throughout
 * the app without explicit imports in every module.
 */
@Global()
@Module({
  providers:   [SecurityEngineService, ApiKeyService, ApiKeyGuard],
  controllers: [SecurityController, ApiKeyController],
  exports:     [SecurityEngineService, ApiKeyService, ApiKeyGuard],
})
export class SecurityModule {}
