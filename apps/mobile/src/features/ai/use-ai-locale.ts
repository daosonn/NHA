import { useTranslation } from 'react-i18next';

import type { AiLocale } from '../../lib/api';

/**
 * Ngôn ngữ để YÊU CẦU AI trả lời — phải theo ngôn ngữ người dùng đang xem app.
 *
 * Không có nó thì server dùng mặc định 'en' và người dùng tiếng Nhật nhận về
 * những ý tưởng quà bằng tiếng Anh nằm giữa một màn hình tiếng Nhật (Sơn gặp
 * đúng lỗi này ngày 19/08).
 */
export function useAiLocale(): AiLocale {
  const { i18n } = useTranslation();
  const tag = (i18n.language || 'en').toLowerCase();
  if (tag.startsWith('ja')) return 'ja';
  if (tag.startsWith('vi')) return 'vi';
  return 'en';
}
