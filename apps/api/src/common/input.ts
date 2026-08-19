import { BadRequestException } from '@nestjs/common';

/**
 * Shared input coercions for content services. Extracted 2026-08-19 when
 * MemoService would have become the third copy (post.service.ts and
 * life-event.service.ts / profile.service.ts had the first two).
 */

/** Trim-to-null: '' and whitespace-only become null. `null` is possible at
 *  runtime on PATCH DTOs (PartialType admits explicit JSON null) and means
 *  "clear" for nullable columns. */
export function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Required trimmed text. Guards the two holes DTO validation leaves
 *  open: @IsNotEmpty() accepts "   " (it only rejects ''), and PartialType
 *  applies @IsOptional, which skips every validator for an explicit JSON
 *  null — null.trim() would be a 500. */
export function requireTrimmed(
  value: string | null | undefined,
  message: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

/** @IsISO8601({ strict: true }) guards the format; this guards forms JS
 *  Date cannot parse (week dates, ordinal dates) from becoming an Invalid
 *  Date that Prisma turns into a 500. */
export function parseIsoDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a parsable date`);
  }
  return date;
}
