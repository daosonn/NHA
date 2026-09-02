import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Images, LogOut, Lock, Upload, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Sheet } from '../../src/components/ai/sheet';
import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilyPhotos } from '../../src/features/omoide/use-family-photos';
import { uploadDrafts } from '../../src/features/moment/upload-drafts';
import { families, type UpdateFamilyRequest } from '../../src/lib/api';
import { collapseTo, useSafeBack } from '../../src/lib/back';
import { thumbnailSource } from '../../src/lib/media-source';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing } from '../../src/theme';

const MAX_NAME = 80;
const MAX_ADDRESS = 120;
const MAX_ABOUT = 140;

/** Ảnh bìa sắp-là: id có sẵn trong nhà, hoặc file vừa chọn chưa upload. */
type CoverDraft =
  | { kind: 'keep' }
  | { kind: 'existing'; mediaId: string; mimeType: string }
  | { kind: 'upload'; uri: string; fileName: string; mimeType: string };

/**
 * Màn 13b — sửa gia đình: ảnh bìa (Upload / Pick from album), tên, địa chỉ,
 * đôi câu giới thiệu (≤140), lối vào quản lý thành viên, và rời nhà.
 *
 * "Who can add photos" trong mockup hiển thị nhưng KHÔNG có setting nào phía
 * sau — hàng đó vẽ giá trị thật duy nhất của app ("mọi thành viên") và không
 * bấm được: một toggle server không enforce là lời nói dối của UI
 * (nguyên tắc đã ghi ở docs/00-shared/api-contract.md § privacy).
 */
export default function EditFamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ familyId?: string }>();
  const familyId = params.familyId ?? null;
  const goBack = useSafeBack('/omoide');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { setFamilyId } = useActiveFamily();

  const detail = useQuery({
    queryKey: queryKeys.family(familyId ?? 'none'),
    queryFn: () => families.detail(familyId as string),
    enabled: familyId !== null,
  });
  const photos = useFamilyPhotos(familyId);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [about, setAbout] = useState('');
  const [cover, setCover] = useState<CoverDraft>({ kind: 'keep' });
  const [albumSheet, setAlbumSheet] = useState(false);
  const [leaveSheet, setLeaveSheet] = useState(false);

  // Nạp form đúng một lần khi detail về — sửa dở không bị server ghi đè.
  const seeded = useRef(false);
  useEffect(() => {
    if (!detail.data || seeded.current) return;
    seeded.current = true;
    setName(detail.data.name);
    setAddress(detail.data.address ?? '');
    setAbout(detail.data.about ?? '');
  }, [detail.data]);

  const save = useMutation({
    mutationFn: async () => {
      let coverMediaId: string | undefined;
      if (cover.kind === 'existing') {
        coverMediaId = cover.mediaId;
      } else if (cover.kind === 'upload') {
        // Upload lúc LƯU chứ không lúc chọn — huỷ form thì không để lại
        // media mồ côi nào trong kho.
        const [uploaded] = await uploadDrafts([
          {
            id: cover.uri,
            kind: 'photo',
            tone: 'light',
            uri: cover.uri,
            fileName: cover.fileName,
            mimeType: cover.mimeType,
          },
        ]);
        coverMediaId = uploaded;
      }
      const body: UpdateFamilyRequest = {};
      if (detail.data !== undefined) {
        if (name.trim() !== detail.data.name) body.name = name.trim();
        if (address.trim() !== (detail.data.address ?? '')) body.address = address.trim();
        if (about.trim() !== (detail.data.about ?? '')) body.about = about.trim();
      }
      if (coverMediaId !== undefined) body.coverMediaId = coverMediaId;
      if (Object.keys(body).length === 0) {
        return null; // không đổi gì — thoát êm, đừng gửi PATCH rỗng (server 400)
      }
      return families.update(familyId as string, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId ?? '') });
      toast.success(t('family.edit.saved'));
      goBack();
    },
    onError: () => toast.failure(t('family.edit.saveFailed')),
  });

  const myMemberId =
    detail.data?.members.find((m) => m.userId === user?.id)?.id ?? null;

  const leave = useMutation({
    mutationFn: () =>
      families.removeMember(familyId as string, myMemberId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success(t('family.edit.leftToast'));
      // Về Omoide — màn shelf và form này đều thuộc về cái nhà vừa rời.
      collapseTo(router, '/omoide');
    },
    onError: () => toast.failure(t('family.edit.saveFailed')),
  });

  const pickUpload = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return;
    setCover({
      kind: 'upload',
      uri: asset.uri,
      fileName: asset.fileName ?? 'family-cover.jpg',
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  // Ảnh xem trước của bìa sắp-là.
  const coverPreview =
    cover.kind === 'upload'
      ? { uri: cover.uri }
      : cover.kind === 'existing'
        ? thumbnailSource(cover.mediaId, cover.mimeType)
        : detail.data?.coverMediaId
          ? thumbnailSource(detail.data.coverMediaId, 'image/jpeg')
          : null;

  const albumTiles = photos.days
    .flatMap((day) => day.rows.flat())
    .filter((tile) => tile.mimeType.startsWith('image/'))
    .slice(0, 30);

  const memberNames = (detail.data?.members ?? [])
    .map((m) => m.displayName)
    .slice(0, 3)
    .join(', ');

  return (
    <FormScreen
      onClose={goBack}
      title={t('family.edit.title')}
      footer={
        <Button
          label={t('family.edit.save')}
          variant="primary"
          size="large"
          fullWidth
          disabled={name.trim() === '' || detail.data === undefined}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 15, paddingBottom: spacing.xl }}
      >
        {/* ---- ảnh bìa + hai nút (13b) ---- */}
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 6 }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: radius.full,
              overflow: 'hidden',
              backgroundColor: colors.coral.light,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 0 3px ${colors.background.card}, 0 4px 16px rgba(24,24,27,0.1)`,
            }}
          >
            {coverPreview === null ? (
              <Images size={30} color={colors.coral.deep} strokeWidth={2} />
            ) : (
              <Image
                source={coverPreview}
                contentFit="cover"
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={t('family.edit.upload')}
              variant="neutral"
              size="medium"
              renderIcon={(props) => <Upload {...props} strokeWidth={2.1} />}
              onPress={() => void pickUpload()}
            />
            <Button
              label={t('family.edit.pickFromAlbum')}
              variant="neutral"
              size="medium"
              renderIcon={(props) => <Images {...props} strokeWidth={2.1} />}
              onPress={() => setAlbumSheet(true)}
            />
          </View>
        </View>

        {/* ---- tên ---- */}
        <TextField
          label={t('family.edit.name')}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME}
        />

        {/* ---- về gia đình ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('family.edit.aboutSection')}
          </Text>
          <Card padding={spacing.lg}>
            <View style={{ gap: 12 }}>
              <TextField
                label={t('family.edit.address')}
                value={address}
                onChangeText={setAddress}
                maxLength={MAX_ADDRESS}
              />
              <TextField
                label={t('family.edit.about')}
                value={about}
                onChangeText={setAbout}
                maxLength={MAX_ABOUT}
                multiline
                hint={`${about.length}/${MAX_ABOUT}`}
              />
            </View>
          </Card>
        </View>

        {/* ---- thành viên + quyền ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('family.edit.membersSection')}
          </Text>
          <Card padding={8}>
            <Pressable
              onPress={() => {
                if (familyId !== null) setFamilyId(familyId);
                router.push('/family');
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                padding: 6,
                backgroundColor: pressed ? colors.background.surfaceSoft : 'transparent',
              })}
            >
              <IconBadge
                size={34}
                background={colors.coral.light}
                foreground={colors.coral.deep}
                renderIcon={(props) => <Users {...props} strokeWidth={2.1} />}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text variant="body2" weight="semibold">
                  {t('family.edit.members', { count: detail.data?.members.length ?? 0 })}
                </Text>
                <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                  {memberNames}
                </Text>
              </View>
              <ChevronRight size={17} color={colors.text.subtle} strokeWidth={2} />
            </Pressable>
            <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
            {/* Hàng này CHỈ nói sự thật: app chưa có quyền đăng theo nhà, nên
                không có chevron và không có toggle nào để bấm. */}
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 11, padding: 6 }}
            >
              <IconBadge
                size={34}
                background={colors.background.subtle}
                foreground={colors.text.muted}
                renderIcon={(props) => <Lock {...props} strokeWidth={2.1} />}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text variant="body2" weight="semibold">
                  {t('family.edit.whoCanAdd')}
                </Text>
                <Text variant="caption" color={colors.text.muted}>
                  {t('family.edit.anyMember')}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ---- rời nhà ---- */}
        {myMemberId !== null && (
          <Pressable
            onPress={() => setLeaveSheet(true)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4, paddingVertical: 2 }}
          >
            <LogOut size={16} color={colors.themes.destructive.text} strokeWidth={2.1} />
            <Text variant="body2" weight="semibold" color={colors.themes.destructive.text}>
              {t('family.edit.leave')}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ---- sheet chọn ảnh từ album nhà ---- */}
      <Sheet
        visible={albumSheet}
        onClose={() => setAlbumSheet(false)}
        title={t('family.edit.pickFromAlbum')}
        subtitle={t('family.edit.pickHint')}
      >
        {albumTiles.length === 0 ? (
          <Text variant="body2" color={colors.text.muted}>
            {t('family.edit.noPhotos')}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {albumTiles.map((tile) => (
              <Pressable
                key={tile.id}
                onPress={() => {
                  setCover({ kind: 'existing', mediaId: tile.id, mimeType: tile.mimeType });
                  setAlbumSheet(false);
                }}
                accessibilityRole="button"
                style={{ width: '31%', aspectRatio: 1 }}
              >
                <Image
                  source={thumbnailSource(tile.id, tile.mimeType)}
                  recyclingKey={tile.id}
                  contentFit="cover"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: radius.lg,
                    backgroundColor: colors.background.subtle,
                  }}
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>

      {/* ---- xác nhận rời nhà ---- */}
      <Sheet
        visible={leaveSheet}
        onClose={() => setLeaveSheet(false)}
        title={t('family.edit.leaveTitle', { name: detail.data?.name ?? '' })}
        subtitle={t('family.edit.leaveBody')}
      >
        <View style={{ gap: 8 }}>
          <Button
            label={t('family.edit.leaveConfirm')}
            variant="destructiveSolid"
            size="large"
            fullWidth
            loading={leave.isPending}
            onPress={() => leave.mutate()}
          />
          <Button
            label={t('family.edit.leaveKeep')}
            variant="neutral"
            size="large"
            fullWidth
            onPress={() => setLeaveSheet(false)}
          />
        </View>
      </Sheet>
    </FormScreen>
  );
}
