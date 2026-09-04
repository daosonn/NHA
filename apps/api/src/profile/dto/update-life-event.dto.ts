import { PartialType } from '@nestjs/swagger';
import { CreateLifeEventDto } from './create-life-event.dto';

/**
 * Everything on a life event is wiki-editable. `undefined` = unchanged.
 *
 * `mediaIds` **replaces** the entry's photos — an array is the new set,
 * omitted (or null) leaves them alone. That is the same "only an array
 * replaces" rule `taggedMemberIds` already follows, so the two collections on
 * this DTO behave alike. Ids new to the set must be the caller's own
 * unattached uploads; ids dropped from it have their `Media` rows and their
 * stored files deleted, exactly as deleting the whole entry does.
 *
 * Media used to be omitted here — "fixed at creation (same rule as posts)" —
 * which left no way to correct a photo attached to the wrong milestone short
 * of deleting the milestone. Opened 2026-09-03 on the owner's call. Posts
 * still have the old restriction; whether it should move too is a product
 * question, not a technical one.
 *
 * Nothing is omitted from the create shape any more. `shareToFeed` used to
 * be — an update never wrote a post, so accepting the field only invited
 * someone to believe it did — and it left `CreateLifeEventDto` entirely on
 * 2026-09-03 when creating a milestone stopped writing one either.
 */
export class UpdateLifeEventDto extends PartialType(CreateLifeEventDto) {}
