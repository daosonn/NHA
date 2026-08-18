import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '../../src/components/layout/placeholder-screen';

export default function OmoideScreen() {
  const { t } = useTranslation();

  return <PlaceholderScreen title={t('nav.omoide')} />;
}
