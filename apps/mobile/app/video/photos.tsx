import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { safeBack } from '../../src/lib/back';
import { Plus, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Pill } from '../../src/components/ai/pill';
import { AppHeader } from '../../src/components/layout/app-header';
import { ContentColumn, contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useMemberForUser } from '../../src/features/family/use-member-for-user';
import { useVideoDraft } from '../../src/features/video/draft';
import { useVideoPhotos, type VideoPhotoTile } from '../../src/features/video/use-video-photos';
import { gallery, media } from '../../src/lib/api';
import { thumbnailSource } from '../../src/lib/media-source';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 28 (11m) — "Sources by family group, numbered order, add more".
 * SỐ trên ảnh là THỨ TỰ xuất hiện trong video; tap lại để bỏ. "Choose for me"
 * là bộ tuyển có nguyên tắc (xem chooseForMe); ô "+ Add" upload từ máy.
 */

type Filter = 'all' | 'mine' | 'recipient' | string; // string = familyId (UUID, không đụng 'recipient')

/**
 * Số cảnh theo thời lượng đã chọn — mỗi cảnh ~5-6 giây cộng mở/kết.
 * Bản cũ lấy cứng 8 bất kể video 30 giây hay 3 phút.
 */
const SCENE_TARGET: Record<number, number> = { 30: 6, 60: 8, 90: 10, 120: 12, 180: 16 };

/** Một BÀI đăng = một khoảnh khắc: gom ảnh cùng bài để không lấy 2 khung cùng cảnh. */
type MomentGroup = {
  key: string;
  tiles: VideoPhotoTile[];
  /** 3 = ảnh chung hai người · 2 = của người nhận · 1 = của mình · 0 = cả nhà. */
  tier: number;
  /** Tim + bình luận — "tấm cả nhà thích" thắng khi cùng tier. */
  popularity: number;
  at: number;
};

export default function VideoPhotosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const { familyId } = useActiveFamily();
  const { draft, update } = useVideoDraft();

  const { tiles, familyList, isLoading } = useVideoPhotos();
  const [filter, setFilter] = useState<Filter>('all');
  const [uploading, setUploading] = useState(false);
  // Người TẶNG (chính mình) trong nhà đang mở — để nhận ra "ảnh chung hai người".
  const giverMemberId = useMemberForUser(user?.id ?? null)?.id ?? null;
  // Mỗi lần bấm "nhờ chọn" xoay sang một lượt khác trong cùng nguyên tắc.
  const [shuffleNonce, setShuffleNonce] = useState(0);

  // "Ảnh của <người nhận>" — hỏi server chứ không tự lọc client, vì gallery
  // của một người gồm cả bài họ ĐĂNG lẫn bài họ ĐƯỢC TAG, tính đúng danh tính
  // xuyên nhiều nhà (client chỉ thấy tag của nhà đang mở). Trả về Media id
  // nên giao thẳng với lưới tile bằng Set.
  const recipientGallery = useQuery({
    queryKey: queryKeys.memberGallery(familyId ?? 'none', draft.memberId ?? 'none'),
    queryFn: () => gallery.forMember(familyId as string, draft.memberId as string),
    enabled: familyId !== null && draft.memberId !== null,
  });
  const recipientIds = useMemo(
    () => new Set((recipientGallery.data ?? []).map((item) => item.id)),
    [recipientGallery.data],
  );

  const visible = useMemo(() => {
    if (filter === 'all') return tiles;
    if (filter === 'mine') return tiles.filter((p) => p.authorUserId === user?.id);
    if (filter === 'recipient') return tiles.filter((p) => recipientIds.has(p.id));
    return tiles.filter((p) => p.familyId === filter);
  }, [tiles, filter, user?.id, recipientIds]);

  const clipTotal = useMemo(
    () => tiles.filter((p) => p.mimeType.startsWith('video/')).length,
    [tiles],
  );

  /** Chọn/bỏ chọn — ghi luôn image|video để màn khác không phải hỏi lại feed. */
  const select = (ids: string[]) => {
    const kinds: Record<string, 'image' | 'video'> = { ...draft.mediaKinds };
    for (const id of ids) {
      const mime = tiles.find((p) => p.id === id)?.mimeType ?? '';
      if (mime) kinds[id] = mime.startsWith('video/') ? 'video' : 'image';
    }
    update({ mediaIds: ids, mediaKinds: kinds });
  };

  const toggle = (id: string) =>
    select(
      draft.mediaIds.includes(id)
        ? draft.mediaIds.filter((x) => x !== id)
        : [...draft.mediaIds, id],
    );

  /**
   * "Nhờ chọn" — bộ tuyển có nguyên tắc thay cho `slice(0, 8)` cũ (Sơn chốt 26/08):
   *
   * 1. SỐ CẢNH theo thời lượng đã chọn (30s→6 … 3min→16), không cứng 8.
   * 2. ƯU TIÊN NGƯỜI: ảnh chung của người nhận VÀ mình > ảnh của người nhận >
   *    ảnh của mình > ảnh cả nhà; cùng hạng thì bài nhiều tim/bình luận thắng.
   * 3. TRẢI THEO THỜI GIAN: chia dòng thời gian thành N khoang, mỗi khoang lấy
   *    một khoảnh khắc — video chạy từ kỷ niệm cũ đến mới, không dồn một buổi.
   * 4. MỖI BÀI MỘT KHUNG (ảnh cùng bài là cùng cảnh) và CLIP chiếm ~3/4 số
   *    cảnh khi có đủ (nhóm điểm cao nhận clip trước).
   * 5. Kết quả xếp xuôi dòng thời gian; bấm lại là một lượt khác cùng nguyên tắc.
   *
   * Thuần client trên dữ liệu đã tải sẵn — không chờ thêm request nào.
   */
  const chooseForMe = () => {
    const count = SCENE_TARGET[draft.targetSec] ?? 8;
    const giverUserId = user?.id ?? null;

    const groups = new Map<string, MomentGroup>();
    for (const p of visible) {
      const recipientRelated =
        draft.memberId !== null &&
        (recipientIds.has(p.id) || p.taggedMemberIds.includes(draft.memberId));
      const giverRelated =
        (giverMemberId !== null && p.taggedMemberIds.includes(giverMemberId)) ||
        (giverUserId !== null && p.authorUserId === giverUserId);
      const tier = recipientRelated && giverRelated ? 3 : recipientRelated ? 2 : giverRelated ? 1 : 0;

      const key = p.postId || p.id;
      const existing = groups.get(key);
      if (existing === undefined) {
        groups.set(key, {
          key,
          tiles: [p],
          tier,
          popularity: p.popularity,
          at: Date.parse(p.createdAt) || 0,
        });
      } else {
        existing.tiles.push(p);
        if (tier > existing.tier) existing.tier = tier;
      }
    }

    const list = [...groups.values()].sort((a, b) => a.at - b.at);
    if (list.length === 0) return;

    const byScore = (a: MomentGroup, b: MomentGroup) =>
      b.tier - a.tier || b.popularity - a.popularity || b.at - a.at;

    // Khoang thời gian đều nhau trên quãng từ khoảnh khắc cũ nhất tới mới nhất
    const lo = list[0]!.at;
    const span = Math.max(1, list[list.length - 1]!.at - lo);
    const buckets: MomentGroup[][] = Array.from({ length: count }, () => []);
    for (const g of list) {
      const idx = Math.min(count - 1, Math.floor(((g.at - lo) / span) * count));
      buckets[idx]!.push(g);
    }

    const picked: MomentGroup[] = [];
    const taken = new Set<string>();
    buckets.forEach((bucket, i) => {
      if (bucket.length === 0) return;
      bucket.sort(byScore);
      // nonce xoay trong top-3 của khoang: bấm lại đổi lượt nhưng không rơi
      // xuống những tấm kém hẳn
      const top = bucket.slice(0, Math.min(3, bucket.length));
      const g = top[(shuffleNonce + i) % top.length]!;
      picked.push(g);
      taken.add(g.key);
    });

    // Khoang rỗng (giai đoạn không có ảnh) → bù bằng nhóm tốt nhất còn lại
    if (picked.length < count) {
      const rest = list.filter((g) => !taken.has(g.key)).sort(byScore);
      for (const g of rest) {
        if (picked.length >= count) break;
        picked.push(g);
      }
    }

    // Trong mỗi khoảnh khắc lấy MỘT file: clip trước cho tới ~3/4 số cảnh
    // (Sơn muốn video nhiều chuyển động), nhóm điểm cao được nhận clip trước.
    const clipQuota = Math.ceil(picked.length * 0.75);
    let clipCountPicked = 0;
    const chosenTile = new Map<string, VideoPhotoTile>();
    for (const g of [...picked].sort(byScore)) {
      const clip = g.tiles.find((p) => p.mimeType.startsWith('video/'));
      const photo = g.tiles.find((p) => !p.mimeType.startsWith('video/'));
      const tile = clipCountPicked < clipQuota ? (clip ?? photo) : (photo ?? clip);
      if (tile === undefined) continue;
      if (tile.mimeType.startsWith('video/')) clipCountPicked += 1;
      chosenTile.set(g.key, tile);
    }

    // Thứ tự chọn = thứ tự xuất hiện trong video → chuyện kể xuôi dòng
    const ids = [...picked]
      .sort((a, b) => a.at - b.at)
      .map((g) => chosenTile.get(g.key)?.id)
      .filter((x): x is string => x !== undefined);

    setShuffleNonce((n) => n + 1);
    select(ids);
  };

  /**
   * "+ Add" — chọn từ máy, upload, tự tick vào cuối thứ tự.
   * Ô mới lưu trong DRAFT (không phải state của màn) nên rời màn rồi quay lại
   * vẫn còn — trước đây nó biến mất và ô đã chọn trông như rỗng.
   */
  const addFromDevice = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.92,
    });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const up = await media.upload({
        uri: asset.uri,
        name: asset.fileName ?? `add-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        type: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      });
      update({
        uploadedTiles: [
          { id: up.id, mimeType: up.mimeType, createdAt: up.createdAt },
          ...draft.uploadedTiles,
        ],
        mediaIds: [...draft.mediaIds, up.id],
        mediaKinds: {
          ...draft.mediaKinds,
          [up.id]: up.mimeType.startsWith('video/') ? 'video' : 'image',
        },
      });
    } catch {
      // Upload hỏng (mạng, file quá lớn, 401) mà không nói gì thì người dùng
      // chỉ thấy spinner tắt rồi… không có gì — cùng chuẩn báo lỗi với upload
      // avatar bên màn hồ sơ.
      toast.failure(t('errors.generic'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/video/setup" />}
        center={<ScreenTitle title={t('video.photosTitle')} />}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: 130,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* filter chips: Everyone / <family> / Mine (11m) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {/* Thứ tự Sơn chốt 26/08: mọi người → người sẽ nhận → của mình → từng nhà */}
          <Pill
            label={t('video.filterEveryone')}
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {/* video làm VỀ một người thì phải lọc được ảnh của đúng người đó */}
          {draft.memberId !== null && draft.memberName.length > 0 && (
            <Pill
              label={t('video.filterRecipient', { name: draft.memberName })}
              selected={filter === 'recipient'}
              onPress={() => setFilter('recipient')}
            />
          )}
          <Pill
            label={t('video.filterMine')}
            selected={filter === 'mine'}
            onPress={() => setFilter('mine')}
          />
          {familyList.length > 1 &&
            familyList.map((f) => (
              <Pill
                key={f.id}
                label={f.name}
                selected={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
        </ScrollView>

        {/* "46 photos and 3 clips shared with you" + Choose for me */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
            {t('video.photosShared', { photos: tiles.length - clipTotal, clips: clipTotal })}
          </Text>
          <Pressable
            onPress={chooseForMe}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              height: 30,
              paddingHorizontal: 11,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.coral.light : colors.coral.soft,
            })}
          >
            <Sparkles size={13} color={colors.coral.hover} strokeWidth={2.2} />
            <Text variant="badge" weight="semibold" color={colors.coral.hover}>
              {t('video.chooseForMe')}
            </Text>
          </Pressable>
        </View>

        {(isLoading || (filter === 'recipient' && recipientGallery.isLoading)) && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {/* ô "+ Add" đứng đầu lưới (11m) */}
          <Pressable
            onPress={() => void addFromDevice()}
            disabled={uploading}
            accessibilityRole="button"
            style={{
              width: '23.5%',
              aspectRatio: 1,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.state.borderDashed,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              backgroundColor: colors.background.surfaceSoft,
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.coral.primary} />
            ) : (
              <>
                <Plus size={18} color={colors.text.muted} strokeWidth={2.2} />
                <Text variant="badge" color={colors.text.muted}>
                  {t('video.addTile')}
                </Text>
              </>
            )}
          </Pressable>

          {visible.map((p) => {
            const order = draft.mediaIds.indexOf(p.id);
            const selected = order >= 0;
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  width: '23.5%',
                  aspectRatio: 1,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
              >
                {/* A clip has no image of its own to draw: `thumbnailSource`
                    asks for its poster frame instead, or the tile is blank. */}
                <Image
                  source={thumbnailSource(p.id, p.mimeType)}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {p.mimeType.startsWith('video/') && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 5,
                      top: 5,
                      paddingHorizontal: 6,
                      height: 17,
                      justifyContent: 'center',
                      borderRadius: radius.sm,
                      backgroundColor: 'rgba(24,24,27,0.62)',
                    }}
                  >
                    <Text variant="badge" color={colors.text.white}>
                      {t('video.clipBadge')}
                    </Text>
                  </View>
                )}
                {selected && (
                  <>
                    <View
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderWidth: 2.5,
                        borderColor: colors.coral.primary,
                        borderRadius: radius.lg,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 4,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.coral.primary,
                        borderWidth: 1.5,
                        borderColor: colors.background.card,
                      }}
                    >
                      <Text variant="badge" weight="bold" color={colors.text.white}>
                        {order + 1}
                      </Text>
                    </View>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Lưới rỗng phải NÓI RA — trước đây nó trắng trơn và trông như lỗi hiển thị */}
        {!isLoading && visible.length === 0 && (
          <Text variant="caption" color={colors.text.body}>
            {filter === 'all' ? t('video.noPhotosYet') : t('video.noPhotosInFilter')}
          </Text>
        )}

        <Text variant="badge" color={colors.text.subtle}>
          {t('video.orderHint')}
        </Text>
      </ScrollView>

      {/* footer — "8 chosen, in this order · 1 → 8 · Use these" */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: spacing.xl,
          paddingBottom: 28,
          backgroundColor: colors.background.card,
          borderTopWidth: 1,
          borderTopColor: colors.state.borderDefault,
        }}
      >
        {/* The bar spans the window, so its surface and top border still read
            as chrome. What is on it belongs to the column, with the grid. */}
        <ContentColumn style={{ gap: 10 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="caption" weight="semibold">
              {t('video.chosenSummary', { count: draft.mediaIds.length })}
            </Text>
            {draft.mediaIds.length > 0 && (
              <Text variant="caption" color={colors.text.muted}>
                1 → {draft.mediaIds.length}
              </Text>
            )}
          </View>
          <Button
            label={t('video.useThese')}
            variant="primary"
            size="large"
            fullWidth
            disabled={draft.mediaIds.length === 0}
            onPress={() => safeBack(router, '/video/setup')}
          />
        </ContentColumn>
      </View>
    </View>
  );
}
