import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import {
  MeGalleryController,
  MemberGalleryController,
} from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [ProfileModule],
  controllers: [MeGalleryController, MemberGalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
