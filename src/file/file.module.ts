import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from './entities/file.entity';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { UploadService } from './uploadService';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])], // <-- SHU YERDA IMPORT QILINADI
  controllers: [FileController],
  providers: [FileService, UploadService],
  exports: [FileService, UploadService],
})
export class FileModule { }
