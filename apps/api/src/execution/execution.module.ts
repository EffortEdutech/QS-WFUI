import { Module } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { FileModule } from '../file/file.module';
import { LibraryModule } from '../library/library.module';

@Module({
  imports: [FileModule, LibraryModule],
  controllers: [ExecutionController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
