import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '../../src/components/layout/placeholder-screen';

/** Life Profile — Timeline / Album / Memo. Not built yet. */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title={`Member · ${id}`} />;
}
