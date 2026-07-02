import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { ProjectModule } from './project/project.module';
import { WorkflowModule } from './workflow/workflow.module';
import { NodeModule } from './node/node.module';
import { ExecutionModule } from './execution/execution.module';
import { FileModule } from './file/file.module';
import { LibraryModule } from './library/library.module';
import { AiModule } from './ai/ai.module';
import { TemplatesModule } from './templates/templates.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ArtifactModule } from './artifact/artifact.module';
import { DocumentModule } from './document/document.module';
import { ServicesModule } from './services/services.module';
import { NotificationModule } from './notification/notification.module';
import { SupplierModule } from './supplier/supplier.module';
import { RfqDistributionModule } from './rfq-distribution/rfq-distribution.module';
import { QuotationModule } from './quotation/quotation.module';
import { ApprovalModule } from './approval/approval.module';
import { ApprovalCoreModule } from './approval/approval-core.module';
import { ResourceModule } from './resource/resource.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { StateEngineModule } from './state-engine/state-engine.module';
import { SecurityModule } from './security/security.module';
import { PackModule } from './pack/pack.module';
import { NodeRegistryModule } from './node-registry/node-registry.module';
import { QueueModule } from './queue/queue.module';
import { WebhookModule } from './webhook/webhook.module';
import { MarketplaceModule }  from './marketplace/marketplace.module';
import { SchedulerModule }    from './scheduler/scheduler.module';     // Phase 10
import { AuditLogModule }    from './audit-log/audit-log.module';      // Phase 11
import { ResourceBindingsModule } from './resource-bindings/resource-bindings.module';
import { DataPacksModule } from './data-packs/data-packs.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SupabaseModule,         // @Global() -- SupabaseService injected everywhere
    HealthModule,
    AuthModule,
    OrganizationModule,
    ProjectModule,
    WorkflowModule,
    NodeModule,             // Sprint 5 -- node registry + pack registry
    ExecutionModule,        // Sprint 6 -- workflow execution engine
    FileModule,             // Sprint 7 -- file uploads to Supabase Storage
    LibraryModule,          // Sprint 8 -- project document library
    AiModule,               // Sprint 9 -- OpenAI wrapper (global, keyword fallback when key absent)
    TemplatesModule,        // Sprint 10 -- workflow templates
    PipelineModule,         // Sprint 11 -- project pipeline canvas
    ArtifactModule,         // Sprint 11 -- inter-workflow artifact store
    DocumentModule,         // Sprint 14 -- unified file-parsing service (global)
    ServicesModule,         // Sprint 14 -- core service registry + GET /services
    NotificationModule,     // Sprint 14 -- in-app notifications (global)
    SupplierModule,         // Sprint 17 -- supplier/contractor database
    RfqDistributionModule,  // Sprint 17 -- RFQ distribution to suppliers
    QuotationModule,        // Sprint 17 -- quotation submission & comparison
    ApprovalCoreModule,     // Phase 7  -- ApprovalTaskCreator (no circular dep; used by foundation-pack)
    ApprovalModule,         // Phase 1  -- human approval inbox + pause/resume
    ResourceModule,         // Phase 3  -- Resource Engine (job/fleet/worker/material/site)
    EventBusModule,         // Phase 4  -- Universal event log + subscription triggers (@Global)
    StateEngineModule,      // Phase 5  -- Configurable state machines + transition guards
    SecurityModule,         // Phase 6  -- Security Engine: RBAC + API keys (@Global)
    PackModule,             // Phase 8  -- Pack Registry + Installer (enable/disable/sync)
    MarketplaceModule,      // Phase 8  -- /marketplace/* + /org/packs routes
    NodeRegistryModule,     // Phase 1H -- GET /node-registry (pack-grouped canvas registry)
    QueueModule,            // Phase 12 -- BullMQ job queue
    WebhookModule,          // Phase 5  -- Inbound webhook delivery → EventBus trigger
    SchedulerModule,        // Phase 10 -- Cron-triggered workflow scheduler
    AuditLogModule,         // Phase 11 -- Audit log API (GET /audit-log + CSV export)
    ResourceBindingsModule, // Phase 15 -- governed workflow resource bindings
    DataPacksModule,        // Phase 19 -- governed Data Pack engine
    MulterModule.register({ dest: '/tmp/uploads' }),
  ],
})
export class AppModule {}
