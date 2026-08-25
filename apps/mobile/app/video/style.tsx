import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Text } from '../../src/components/ui/text';
import { useVideoDraft } from '../../src/features/video/draft';
import type { VideoStyleId } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

/**
 * Màn 30 (11o) — "Six openings: album, cinematic, old film, letter, petals, polaroid.
 * This sets how the video opens and how it feels throughout." Lưới 2 cột, mỗi ô
 * là một minh hoạ nhỏ vẽ bằng View — đúng mockup, không cần ảnh tĩnh.
 */

const ORDER: VideoStyleId[] = ['album', 'cinema', 'film', 'letter', 'seasonal', 'polaroid'];

/** Minh hoạ mini của từng phong cách (nhìn theo mockup 11o). */
function Preview({ id }: { id: VideoStyleId }) {
  switch (id) {
    case 'album':
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#E9DFCC',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 3,
          }}
        >
          <View
            style={{
              width: 30,
              height: 44,
              borderTopLeftRadius: 5,
              borderBottomLeftRadius: 5,
              backgroundColor: '#6B4A2E',
            }}
          />
          <View
            style={{
              width: 26,
              height: 44,
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
              backgroundColor: '#FBF7EE',
              borderWidth: 1,
              borderColor: '#D8CCB4',
            }}
          />
        </View>
      );
    case 'cinema':
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#101014',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: '58%', height: 9, borderRadius: 3, backgroundColor: '#8E8B84' }} />
        </View>
      );
    case 'film':
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#3E382E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: '#CFC7B4',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text weight="semibold" color="#CFC7B4" style={{ fontSize: 13, lineHeight: 16 }}>
              3
            </Text>
          </View>
        </View>
      );
    case 'letter':
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#FBF4E2',
            justifyContent: 'center',
            paddingHorizontal: 14,
            gap: 5,
          }}
        >
          <View
            style={{ height: 3.5, width: '86%', borderRadius: 2, backgroundColor: '#8F8672' }}
          />
          <View
            style={{ height: 3.5, width: '70%', borderRadius: 2, backgroundColor: '#B0a78F' }}
          />
          <View
            style={{ height: 3.5, width: '80%', borderRadius: 2, backgroundColor: '#B0A78F' }}
          />
          <View
            style={{ height: 3.5, width: '52%', borderRadius: 2, backgroundColor: '#C4BCA6' }}
          />
        </View>
      );
    case 'seasonal':
      return (
        <View style={{ flex: 1, backgroundColor: '#F8D7DE' }}>
          {[
            { top: 12, left: 18, s: 9 },
            { top: 30, left: 52, s: 7 },
            { top: 18, left: 92, s: 10 },
            { top: 52, left: 30, s: 6 },
            { top: 58, left: 78, s: 8 },
          ].map((p, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: p.top,
                left: p.left,
                width: p.s,
                height: p.s * 1.25,
                borderRadius: p.s,
                backgroundColor: '#E794A6',
                transform: [{ rotate: `${i * 40}deg` }],
              }}
            />
          ))}
        </View>
      );
    case 'polaroid':
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: '#DDD9D2',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {[-8, 5, 0].map((deg, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: 34,
                height: 40,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
                paddingTop: 4,
                paddingHorizontal: 4,
                transform: [{ rotate: `${deg}deg` }, { translateX: (i - 1) * 9 }],
                boxShadow: '0 1px 3px rgba(24,24,27,0.18)',
              }}
            >
              <View
                style={{ flex: 1, marginBottom: 8, backgroundColor: '#E4E1DC', borderRadius: 2 }}
              />
            </View>
          ))}
        </View>
      );
    default:
      return <View style={{ flex: 1, backgroundColor: colors.background.subtle }} />;
  }
}

export default function VideoStyleScreen() {
  const { t } = useTranslation();
  const { draft, update } = useVideoDraft();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => goBack()} />}
        center={<ScreenTitle title={t('video.styleTitle')} />}
        right={
          <Pressable onPress={() => goBack()} accessibilityRole="button" hitSlop={8}>
            <Text variant="body2" weight="semibold" color={colors.coral.hover}>
              {t('common.done')}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="caption" color={colors.text.body}>
          {t('video.styleHint')}
        </Text>

        {/* lưới 2 cột (11o) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {ORDER.map((id) => {
            const selected = draft.style === id;
            return (
              <Pressable
                key={id}
                onPress={() => update({ style: id })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  width: '48.4%',
                  borderRadius: radius['2xl'],
                  overflow: 'hidden',
                  backgroundColor: colors.background.card,
                  borderWidth: selected ? 2.5 : 1,
                  borderColor: selected ? colors.coral.primary : colors.state.borderDefault,
                }}
              >
                <View style={{ height: 96 }}>
                  <Preview id={id} />
                </View>

                {selected && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 7,
                      right: 7,
                      width: 22,
                      height: 22,
                      borderRadius: radius.full,
                      backgroundColor: colors.coral.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.background.card,
                    }}
                  >
                    <Check size={13} color={colors.text.white} strokeWidth={3} />
                  </View>
                )}

                <View style={{ padding: 10, gap: 2 }}>
                  <Text variant="body2" weight="bold">
                    {t(`video.style.${id}`)}
                  </Text>
                  <Text variant="badge" color={colors.text.muted}>
                    {t(`video.styleDesc.${id}`)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
