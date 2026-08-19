/**
 * Stand-in data for the invite flow.
 *
 * Two things here come straight from the backend and must not drift:
 *
 * 1. **The invite code shape.** `Family.inviteCode` is 8 characters from
 *    `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 32 symbols with `I`, `O`, `0` and
 *    `1` deliberately removed so a code read aloud or copied off a screen
 *    cannot be mistyped. Any code input should therefore force upper case
 *    and never needs to accept those four characters.
 * 2. **Kinship words are not relationship types.** `database.md` is explicit
 *    that kinship labels (sister, grandmother, uncle) are *derived* from the
 *    graph and must never become enum values. The picker offers them as
 *    input shortcuts and each one carries the base `RelationshipType` edge
 *    the API actually stores.
 */

/** `RelationshipType` in `schema.prisma`. */
export type RelationshipType =
  'PARENT' | 'SPOUSE' | 'SIBLING' | 'ADOPTED_PARENT' | 'STEP_PARENT' | 'OTHER';

export type KinshipOption = {
  value: string;
  /** The word the inviter picks. */
  label: string;
  /** The edge stored on `Relationship.type`. */
  type: RelationshipType;
  /** Where this lands them relative to you, in the reader's words. */
  hint: string;
  /**
   * Which end of the stored edge the **new** person sits on.
   *
   * `Relationship` is directed for parenthood — `from` is the parent — so
   * "Mother" and "Daughter" are the same `PARENT` type pointing opposite
   * ways. Getting this backwards silently inverts a generation in the tree.
   */
  newMemberIsFrom: boolean;
};

export const kinshipOptions: KinshipOption[] = [
  {
    value: 'sister',
    label: 'Sister',
    type: 'SIBLING',
    hint: 'Same generation as you',
    newMemberIsFrom: false,
  },
  {
    value: 'brother',
    label: 'Brother',
    type: 'SIBLING',
    hint: 'Same generation as you',
    newMemberIsFrom: false,
  },
  {
    value: 'mother',
    label: 'Mother',
    type: 'PARENT',
    hint: 'One generation above you',
    newMemberIsFrom: true,
  },
  {
    value: 'father',
    label: 'Father',
    type: 'PARENT',
    hint: 'One generation above you',
    newMemberIsFrom: true,
  },
  {
    value: 'daughter',
    label: 'Daughter',
    type: 'PARENT',
    hint: 'One generation below you',
    newMemberIsFrom: false,
  },
  {
    value: 'son',
    label: 'Son',
    type: 'PARENT',
    hint: 'One generation below you',
    newMemberIsFrom: false,
  },
  {
    value: 'partner',
    label: 'Partner',
    type: 'SPOUSE',
    hint: 'Beside you',
    newMemberIsFrom: false,
  },
  {
    value: 'step-parent',
    label: 'Step-parent',
    type: 'STEP_PARENT',
    hint: 'One generation above',
    newMemberIsFrom: true,
  },
  {
    value: 'other',
    label: 'Someone else',
    type: 'OTHER',
    hint: 'You describe the relationship',
    newMemberIsFrom: false,
  },
];

/** Where in the tree the invitee will land. */
export type TreeSpot = {
  /** `FamilyMember.id` once the placeholder row exists. */
  id: string;
  /** "Gen 3 · beside Minh · child of Mai & Hoang". */
  summary: string;
};

export const defaultSpot: TreeSpot = {
  id: 'node_03',
  summary: 'Gen 3 · beside Minh · child of Mai & Hoang',
};

export const familyInviteCode = 'K7M2QRXP';

/** What the tree shows while someone has been invited but has not joined. */
export type PendingInvite = {
  /** The `FamilyMember` row already reserving the spot. */
  memberId: string;
  name: string;
  role: string;
  sentAgo: string;
};

export const pendingInvite: PendingInvite = {
  memberId: 'linh',
  name: 'Linh',
  role: 'Sister',
  sentAgo: '2 min ago',
};

/** The other side of the flow: what the invitee sees when the link opens. */
export type Invitation = {
  code: string;
  inviterName: string;
  familyName: string;
  /** The kinship word the inviter chose. */
  role: string;
  memberCount: number;
  momentCount: number;
  /** The two people above the spot, then the spot's sibling. */
  parents: { id: string; name: string; role: string; tone: 'light' | 'dark' }[];
  sibling: { id: string; name: string; tone: 'light' | 'dark' };
};

export const invitation: Invitation = {
  code: familyInviteCode,
  inviterName: 'Minh',
  familyName: "Mom's side",
  role: 'Sister',
  memberCount: 9,
  momentCount: 312,
  parents: [
    { id: 'mai', name: 'Mai', role: 'Mom', tone: 'dark' },
    { id: 'hoang', name: 'Hoang', role: 'Dad', tone: 'light' },
  ],
  sibling: { id: 'minh', name: 'Minh', tone: 'light' },
};
