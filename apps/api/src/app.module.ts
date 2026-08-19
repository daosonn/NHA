import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { FamilyModule } from './family/family.module';
import { MediaModule } from './media/media.module';
import { MemoModule } from './memo/memo.module';
import { PostModule } from './post/post.module';
import { ProfileModule } from './profile/profile.module';
import { SpecialDateModule } from './special-date/special-date.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    FamilyModule,
    MediaModule,
    MemoModule,
    PostModule,
    ProfileModule,
    SpecialDateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
