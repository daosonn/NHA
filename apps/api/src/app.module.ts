import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AlbumModule } from './album/album.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { FamilyModule } from './family/family.module';
import { GalleryModule } from './gallery/gallery.module';
import { MediaModule } from './media/media.module';
import { MemoModule } from './memo/memo.module';
import { NotificationModule } from './notification/notification.module';
import { PostModule } from './post/post.module';
import { ProfileModule } from './profile/profile.module';
import { SettingsModule } from './settings/settings.module';
import { SpecialDateModule } from './special-date/special-date.module';
import { VideoModule } from './video/video.module';

/**
 * ⚠ `src/video-job/` (VideoJobModule, WBS 2.2.3) is deliberately NOT imported.
 *
 * It and `src/video/` (VideoModule, screens 27-33) both answer `GET /video-jobs`
 * and `GET /video-jobs/:jobId`, so registering both means one silently shadows the
 * other. They also assume different lifecycles: VideoJobModule expects an external
 * renderer to report back on `POST /internal/video-jobs/:jobId/complete`, while
 * VideoModule renders in-process (ffmpeg, 0 tokens) and streams the result.
 *
 * VideoModule is wired because it is what the mobile app calls end to end today
 * (storyboard → job → progress/stage → file → share). The other module is kept in
 * the tree untouched so the team can decide which lifecycle survives — see the PR
 * description. Whichever wins, only ONE should own the `/video-jobs` namespace.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    AlbumModule,
    AuthModule,
    FamilyModule,
    GalleryModule,
    MediaModule,
    MemoModule,
    NotificationModule,
    PostModule,
    ProfileModule,
    SettingsModule,
    SpecialDateModule,
    VideoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
