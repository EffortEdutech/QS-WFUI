import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './email.service';   // Phase 10
import { SmsService }   from './sms.service';     // Phase 10

/**
 * NotificationModule — Sprint 14 (S14-004) / Phase 10
 * Global so NotificationService, EmailService, SmsService can be
 * injected anywhere (e.g. notifications-pack node executors).
 */
@Global()
@Module({
  providers:   [NotificationService, EmailService, SmsService],
  controllers: [NotificationController],
  exports:     [NotificationService, EmailService, SmsService],
})
export class NotificationModule {}
