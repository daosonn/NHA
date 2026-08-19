import type { RelationshipType } from '../../lib/api';

/**
 * The words a person picks, and the edges they mean.
 *
 * `docs/02-backend/database.md` is explicit that kinship words — sister,
 * grandmother, uncle — are *derived* from the graph and must never become
 * enum values. So this table is an input shortcut in one direction only: the
 * picker offers a word, and what gets stored is the base `RelationshipType`
 * plus the direction. Nothing reads a word back out of it.
 *
 * Labels are catalogue keys rather than text. The picker is one of the few
 * places where a noun is chosen rather than displayed, and `姉` is not a
 * translation a string table can reach if "Sister" has already been baked in
 * (`architecture.md` § Language).
 */
export type KinshipOption = {
  value: string;
  /** Catalogue key for the word itself. */
  labelKey: string;
  /** Catalogue key for where this lands them, in the reader's words. */
  hintKey: string;
  /** The edge stored on `Relationship.type`. */
  type: RelationshipType;
  /**
   * Which end of the stored edge the **new** person sits on.
   *
   * `Relationship` is directed for parenthood — `from` is the parent — so
   * "Mother" and "Daughter" are the same `PARENT` type pointing opposite
   * ways. Getting this backwards silently inverts a generation in the tree.
   */
  newMemberIsFrom: boolean;
};

const SAME = 'family.kinship.hint.sameGeneration';
const ABOVE = 'family.kinship.hint.above';
const BELOW = 'family.kinship.hint.below';

export const kinshipOptions: KinshipOption[] = [
  {
    value: 'sister',
    labelKey: 'family.kinship.sister',
    hintKey: SAME,
    type: 'SIBLING',
    newMemberIsFrom: false,
  },
  {
    value: 'brother',
    labelKey: 'family.kinship.brother',
    hintKey: SAME,
    type: 'SIBLING',
    newMemberIsFrom: false,
  },
  {
    value: 'mother',
    labelKey: 'family.kinship.mother',
    hintKey: ABOVE,
    type: 'PARENT',
    newMemberIsFrom: true,
  },
  {
    value: 'father',
    labelKey: 'family.kinship.father',
    hintKey: ABOVE,
    type: 'PARENT',
    newMemberIsFrom: true,
  },
  {
    value: 'daughter',
    labelKey: 'family.kinship.daughter',
    hintKey: BELOW,
    type: 'PARENT',
    newMemberIsFrom: false,
  },
  {
    value: 'son',
    labelKey: 'family.kinship.son',
    hintKey: BELOW,
    type: 'PARENT',
    newMemberIsFrom: false,
  },
  {
    value: 'partner',
    labelKey: 'family.kinship.partner',
    hintKey: 'family.kinship.hint.beside',
    type: 'SPOUSE',
    newMemberIsFrom: false,
  },
  {
    value: 'step-parent',
    labelKey: 'family.kinship.stepParent',
    hintKey: ABOVE,
    type: 'STEP_PARENT',
    newMemberIsFrom: true,
  },
  {
    value: 'other',
    labelKey: 'family.kinship.other',
    hintKey: 'family.kinship.hint.custom',
    type: 'OTHER',
    newMemberIsFrom: false,
  },
];

export function kinshipOption(value: string | null): KinshipOption | undefined {
  return value === null ? undefined : kinshipOptions.find((option) => option.value === value);
}

/**
 * The word an invitation was sent under, for the pending banner and the
 * invitation page.
 *
 * `kinshipKey` is what the inviter picked and is the specific answer.
 * `relationshipType` is the stored edge and only says "a parent of somebody",
 * so it is the fallback rather than the first choice — and it cannot say
 * which way a `PARENT` edge points, which is why the banner says "Parent"
 * rather than guessing between mother and daughter.
 */
export function invitedAsKey(
  kinshipKey: string | null,
  relationshipType: RelationshipType,
): string {
  const option = kinshipOption(kinshipKey);
  if (option !== undefined) return option.labelKey;

  switch (relationshipType) {
    case 'PARENT':
      return 'family.relation.parent';
    case 'ADOPTED_PARENT':
      return 'family.relation.adoptedParent';
    case 'STEP_PARENT':
      return 'family.relation.stepParent';
    case 'SPOUSE':
      return 'family.relation.spouse';
    case 'SIBLING':
      return 'family.relation.sibling';
    default:
      return 'family.kinship.other';
  }
}
