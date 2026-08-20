import { resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('takes the first supported candidate, in priority order', () => {
    expect(resolveLocale('ja', 'vi')).toBe('ja');
    expect(resolveLocale(undefined, 'vi')).toBe('vi');
    expect(resolveLocale(null, undefined, 'en')).toBe('en');
  });

  it('falls back to en when nothing is usable', () => {
    expect(resolveLocale()).toBe('en');
    expect(resolveLocale(null, undefined)).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale('   ')).toBe('en');
  });

  it('honours a region subtag by its primary language', () => {
    // What a Settings screen storing a device locale would write.
    expect(resolveLocale('ja-JP')).toBe('ja');
    expect(resolveLocale('vi_VN')).toBe('vi');
    expect(resolveLocale('EN-GB')).toBe('en');
  });

  it('never forwards an unsupported value', () => {
    // The point of the helper: User.locale has no column constraint, so
    // anything can be in there and none of it may reach the AI service.
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale('klingon')).toBe('en');
    expect(resolveLocale('en; DROP TABLE users')).toBe('en');
    expect(resolveLocale('jamaican')).toBe('en'); // not a prefix match for "ja"
  });

  it('skips an unsupported candidate to reach a supported one', () => {
    expect(resolveLocale('fr', 'ja')).toBe('ja');
  });
});
