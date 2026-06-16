import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';

@Module({
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],   // exported so ExecutionModule can inject it
})
export class FileModule {}
