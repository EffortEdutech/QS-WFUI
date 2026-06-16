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
import { MulterModule } from '@nestjs/platform-express';

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
    FileModule,           // Sprint 7 — file uploads to Supabase Storage
    LibraryModule,        // Sprint 8 — project document library
    AiModule,             // Sprint 9 — OpenAI wrapper (global, keyword fallback when key absent)
    TemplatesModule,      // Sprint 10 — workflow templates
    MulterModule.register({ dest: '/tmp/uploads' }),  // in-memory buffer preferred
  ],
})
export class AppModule {}
