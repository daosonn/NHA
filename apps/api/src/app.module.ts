import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { FamilyModule } from './family/family.module';
import { MediaModule } from './media/media.module';
import { PostModule } from './post/post.module';
import { ProfileModule } from './profile/profile.module';
import { SpecialDateModule } from './special-date/special-date.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    FamilyModule,
    MediaModule,
    PostModule,
    ProfileModule,
    SpecialDateModule,
    AiModule,
    VideoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
