/**
 * The five kinds of family date, as the design speaks about them.
 *
 * This used to be a fixtures file; the AI tab now reads the special-dates
 * API, so only the kind union survives — `occasion-kind.tsx` maps both the
 * fixtures' vocabulary and the API's `SpecialDateType` onto these five.
 */
export type OccasionKind = 'birthday' | 'memorial' | 'anniversary' | 'holiday' | 'milestone';
