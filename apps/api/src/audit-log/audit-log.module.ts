import { Module } from '@nestjs/common';
import { AuditLogService }    from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

// SecurityModule is @Global() — SecurityEngineService auto-injected

@Module({
  providers:   [AuditLogService],
  controllers: [AuditLogController],
  exports:     [AuditLogService],
})
export class AuditLogModule {}
