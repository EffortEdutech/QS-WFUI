import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';
import { SupabaseModule } from '../common/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],   // exported so execution module can use it
})
export class LibraryModule {}
