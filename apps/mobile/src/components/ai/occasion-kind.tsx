import { Cake, Flower, GraduationCap, Heart, Sparkles } from 'lucide-react-native';

import type { SpecialDateItem } from '../../lib/api';
import type { OccasionKind } from '../../fixtures/ai';

type IconProps = { size: number; color: string };

const ICONS: Record<OccasionKind, (props: IconProps) => React.ReactNode> = {
  birthday: (props) => <Cake {...props} strokeWidth={2.1} />,
  memorial: (props) => <Flower {...props} strokeWidth={2.1} />,
  anniversary: (props) => <Heart {...props} strokeWidth={2.1} />,
  holiday: (props) => <Sparkles {...props} strokeWidth={2.1} />,
  milestone: (props) => <GraduationCap {...props} strokeWidth={2.1} />,
};

const LABEL_KEYS: Record<OccasionKind, string> = {
  birthday: 'ai.kinds.birthday',
  memorial: 'ai.kinds.memorial',
  anniversary: 'ai.kinds.anniversary',
  holiday: 'ai.kinds.holiday',
  milestone: 'ai.kinds.milestone',
};

/** One icon and one word per kind of date, used everywhere a date appears. */
export function occasionIcon(kind: OccasionKind): (props: IconProps) => React.ReactNode {
  return ICONS[kind];
}

export function occasionLabelKey(kind: OccasionKind): string {
  return LABEL_KEYS[kind];
}

/** The API speaks SpecialDateType; the icons/labels stay the same five. */
const API_KIND: Record<SpecialDateItem['type'], OccasionKind> = {
  BIRTHDAY: 'birthday',
  ANNIVERSARY: 'anniversary',
  MEMORIAL: 'memorial',
  CUSTOM: 'holiday',
};

export function specialDateIcon(type: SpecialDateItem['type']): (props: IconProps) => React.ReactNode {
  return ICONS[API_KIND[type]];
}

export function specialDateKindKey(type: SpecialDateItem['type']): string {
  return LABEL_KEYS[API_KIND[type]];
}
