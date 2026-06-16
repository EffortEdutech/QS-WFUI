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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SupabaseModule,       // @Global() — SupabaseService injected everywhere
    HealthModule,
    AuthModule,
    OrganizationModule,
    ProjectModule,
    WorkflowModule,
    NodeModule,           // Sprint 5 — node registry + pack registry
    ExecutionModule,      // Sprint 6 — workflow execution engine
  ],
})
export class AppModule {}
