import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PostModule } from '../post/post.module';
import { ProfileModule } from '../profile/profile.module';
import { multerTempStorage } from '../storage/multer-temp-storage';
import { StorageModule } from '../storage/storage.module';
import { StorageService } from '../storage/storage.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

// Single upload limit for every media type (team decision 2026-08-18).
// Multer rejects larger files with 413 while the request streams in.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@Module({
  imports: [
    StorageModule,
    PostModule,
    ProfileModule,
    // Uploads stream to a temp file under the storage root instead of
    // buffering up to 100MB per request in memory; MediaService promotes
    // valid files into their permanent location.
    MulterModule.registerAsync({
      imports: [StorageModule],
      inject: [StorageService],
      useFactory: (storage: StorageService) => ({
        storage: multerTempStorage(storage.tempDir),
        limits: { fileSize: MAX_UPLOAD_BYTES },
      }),
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
