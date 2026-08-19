import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The calendar-day contract, in one place (extracted 2026-08-19 at the
 * fourth copy): strict ISO 8601 AND date-only. Datetimes are rejected
 * because every consumer stores a DATE (or buckets by day) — an offset
 * datetime like `08:00+09:00` would silently shift the day.
 */
export function IsDateOnly(field: string): PropertyDecorator {
  return applyDecorators(
    IsISO8601({ strict: true }),
    Matches(DATE_ONLY, {
      message: `${field} must be a date only (YYYY-MM-DD)`,
    }),
  );
}
