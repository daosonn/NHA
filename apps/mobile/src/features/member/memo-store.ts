/**
 * The notes a person has written about each family member, held in memory.
 *
 * There is no `Memo` endpoint yet (`docs/00-shared/api-contract.md`), and the
 * three screens that write one — editor, actions sheet, delete — are separate
 * routes, so they cannot share React state through props. This module is the
 * store they all read, following the same shape as
 * `features/auth/session-store.ts`: plain module state, a listener set, and a
 * `useSyncExternalStore` view on top.
 *
 * It is seeded from `src/fixtures/member.ts` and lives only as long as the
 * process. When the endpoint arrives this file is what a react-query hook
 * replaces; nothing above it knows where the notes come from.
 */
import { useCallback, useSyncExternalStore } from 'react';

import { getMemberProfile, type MemoItem } from '../../fixtures/member';

/** Notes per member id. A member is seeded the first time it is asked for. */
const byMember = new Map<string, MemoItem[]>();

type Listener = () => void;
const listeners = new Set<Listener>();

function publish(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function seed(memberId: string): MemoItem[] {
  const existing = byMember.get(memberId);
  if (existing !== undefined) return existing;

  const fromFixture = getMemberProfile(memberId).memos;
  byMember.set(memberId, fromFixture);
  return fromFixture;
}

/** Newest first — a note written today is the one being looked for. */
function sorted(memos: MemoItem[]): MemoItem[] {
  return [...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listMemos(memberId: string): MemoItem[] {
  return seed(memberId);
}

export function getMemo(memberId: string, memoId: string): MemoItem | null {
  return seed(memberId).find((memo) => memo.id === memoId) ?? null;
}

/** The editor's save, for both a new note and an edit of an existing one. */
export function saveMemo(memberId: string, memo: MemoItem): void {
  const memos = seed(memberId);
  const index = memos.findIndex((existing) => existing.id === memo.id);

  byMember.set(
    memberId,
    index === -1 ? [memo, ...memos] : memos.map((existing, at) => (at === index ? memo : existing)),
  );
  publish();
}

/**
 * The note just deleted, and where it sat, for as long as Undo is on offer.
 *
 * It lives in the store rather than in the screen that pressed Delete because
 * those are two different screens: the detail screen deletes and then pops,
 * so the offer to undo has to survive it and surface on the profile, next to
 * the gap the note left.
 */
type Deleted = { memberId: string; memo: MemoItem; at: number; deletedAt: number };

let lastDeleted: Deleted | null = null;

/** Matches the toast. After this the deletion is simply done. */
const UNDO_WINDOW_MS = 5000;

/** Removes a note, keeping it only until the undo window closes. */
export function deleteMemo(memberId: string, memoId: string): void {
  const memos = seed(memberId);
  const at = memos.findIndex((memo) => memo.id === memoId);
  if (at === -1) return;

  const memo = memos[at];
  if (memo === undefined) return;

  byMember.set(
    memberId,
    memos.filter((_, index) => index !== at),
  );
  lastDeleted = { memberId, memo, at, deletedAt: Date.now() };
  publish();
}

/** Puts the last delete back where it was, not on top of the list. */
export function undoDelete(): void {
  if (lastDeleted === null) return;

  const { memberId, memo, at } = lastDeleted;
  const next = [...seed(memberId)];
  next.splice(Math.min(at, next.length), 0, memo);

  byMember.set(memberId, next);
  lastDeleted = null;
  publish();
}

/** Lets the offer lapse. The note is gone and nothing keeps a copy of it. */
export function clearDeleted(): void {
  if (lastDeleted === null) return;
  lastDeleted = null;
  publish();
}

function deletedFor(memberId: string): Deleted | null {
  if (lastDeleted === null || lastDeleted.memberId !== memberId) return null;
  // Guards the case where nobody was on screen to run the dismiss timer: come
  // back to a profile ten minutes later and the offer has quietly expired
  // rather than reappearing as if the delete had just happened.
  if (Date.now() - lastDeleted.deletedAt > UNDO_WINDOW_MS) return null;
  return lastDeleted;
}

/** The pending undo for this member, if there is one. */
export function useDeleted(memberId: string): Deleted | null {
  const snapshot = useCallback(() => deletedFor(memberId), [memberId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Every note about this member, newest first, re-read whenever one changes. */
export function useMemos(memberId: string): MemoItem[] {
  const snapshot = useCallback(() => listMemos(memberId), [memberId]);
  return sorted(useSyncExternalStore(subscribe, snapshot, snapshot));
}

/** One note, or null once it has been deleted. Not React's `useMemo`. */
export function useMemoItem(memberId: string, memoId: string): MemoItem | null {
  const snapshot = useCallback(() => getMemo(memberId, memoId), [memberId, memoId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
