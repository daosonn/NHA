import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { Pill } from '../../src/components/ai/pill';
import { FormScreen } from '../../src/components/layout/form-screen';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { SelectField } from '../../src/components/ui/select-field';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { themeFor } from '../../src/features/dates/date-meta';
import {
  useCreateDate,
  useDeleteDate,
  useMyDates,
  useUpdateDate,
} from '../../src/features/dates/use-my-dates';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { families as familiesApi } from '../../src/lib/api';
import type { SpecialDateType } from '../../src/lib/api';
import { useSafeBack } from '../../src/lib/back';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, spacing } from '../../src/theme';

/** Thứ tự chip loại — đúng mockup 12c. CUSTOM hiển thị là "Other". */
const KINDS: SpecialDateType[] = [
  'BIRTHDAY',
  'MEMORIAL',
  'ANNIVERSARY',
  'TET',
  'MILESTONE',
  'CUSTOM',
];

const KIND_LABEL_KEYS: Record<SpecialDateType, string> = {
  BIRTHDAY: 'dates.kinds.birthday',
  MEMORIAL: 'dates.kinds.memorial',
  ANNIVERSARY: 'dates.kinds.anniversary',
  TET: 'dates.kinds.tet',
  MILESTONE: 'dates.kinds.milestone',
  CUSTOM: 'dates.kinds.other',
};

/** Lead nhắc chọn được — mặc định 10 theo mockup ("10 days before"). */
const REMIND_CHOICES = [0, 1, 3, 7, 10, 14] as const;

/** Số ngày của tháng DƯƠNG khi lặp hằng năm — theo năm nhuận để 29/2 hợp lệ
 *  (server trôi nó tới 1/3 ở năm thường, hành vi có sẵn). */
const SOLAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body2" weight="semibold">
          {label}
        </Text>
        {hint !== undefined && (
          <Text variant="caption" color={colors.text.muted}>
            {hint}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.state.disabledBg, true: colors.coral.primary }}
        thumbColor={colors.background.card}
        ios_backgroundColor={colors.state.disabledBg}
        accessibilityLabel={label}
      />
    </View>
  );
}

/**
 * Màn 12c — tạo/sửa một "date we keep". `?id=` là chế độ sửa (chỉ dòng
 * CUSTOM tới được đây; dòng DERIVED sửa trên profile).
 */
export default function NewDateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    familyId?: string;
    scope?: string;
  }>();
  const isEdit = params.id !== undefined && params.id !== '';
  const goBack = useSafeBack('/dates');
  const toast = useToast();

  const familyList = useFamilies();
  const { familyId: activeFamilyId } = useActiveFamily();
  const myDates = useMyDates();
  const create = useCreateDate();
  const update = useUpdateDate();
  const remove = useDeleteDate();

  const now = new Date();
  const [kind, setKind] = useState<SpecialDateType>('BIRTHDAY');
  const [title, setTitle] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());
  const [isLunar, setIsLunar] = useState(false);
  const [repeatsYearly, setRepeatsYearly] = useState(true);
  const [year, setYear] = useState(now.getFullYear());
  // 'me' = Only me; còn lại là familyId. Mặc định: param → nhà đang chọn →
  // nhà đầu tiên — luôn HIỆN RÕ trong ô chọn, không âm thầm (quy tắc omoide).
  const [audience, setAudience] = useState<string>(
    params.scope === 'me' ? 'me' : (params.familyId ?? ''),
  );
  const [remind, setRemind] = useState<number>(10);
  const [armedDelete, setArmedDelete] = useState(false);

  useEffect(() => {
    if (audience === '' && familyList.data !== undefined) {
      const fallback = activeFamilyId ?? familyList.data[0]?.id;
      if (fallback) setAudience(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyList.data, activeFamilyId]);

  // Sửa: nạp dòng từ cache feed tổng hợp, đúng một lần khi nó về.
  const seeded = useRef(false);
  const editing = isEdit
    ? (myDates.data ?? []).find((i) => i.id === params.id)
    : undefined;
  useEffect(() => {
    if (!editing || seeded.current) return;
    seeded.current = true;
    setKind(editing.type);
    setTitle(editing.title ?? '');
    setMemberIds(editing.members.map((m) => m.memberId));
    setMonth(editing.month);
    setDay(editing.day);
    setIsLunar(editing.isLunar);
    setRepeatsYearly(editing.repeatsYearly);
    if (editing.year !== null && editing.year !== undefined) setYear(editing.year);
    setAudience(editing.scope === 'PERSONAL' ? 'me' : (editing.familyId ?? ''));
    if (editing.remindDaysBefore !== null) setRemind(editing.remindDaysBefore);
  }, [editing]);

  // "Who it is for": người lấy từ nhà đang chọn; khi Only me thì vẫn cần một
  // nhà làm nguồn người (server nhận member từ MỌI nhà của mình) — dùng nhà
  // gần nhất đã chọn / mặc định.
  const memberSourceFamilyId =
    audience !== 'me' && audience !== ''
      ? audience
      : (activeFamilyId ?? familyList.data?.[0]?.id ?? null);
  const family = useQuery({
    queryKey: queryKeys.family(memberSourceFamilyId ?? 'none'),
    queryFn: () => familiesApi.detail(memberSourceFamilyId as string),
    enabled: memberSourceFamilyId !== null,
  });
  const members = family.data?.members ?? [];

  const maxDay = isLunar ? 30 : SOLAR_DAYS[month - 1];
  const dayClamped = Math.min(day, maxDay);

  const audienceOptions = [
    ...(familyList.data ?? []).map((f) => ({ value: f.id, label: f.name })),
    { value: 'me', label: t('dates.form.onlyMe'), hint: t('dates.form.onlyMeHint') },
  ];

  const canSave = title.trim().length > 0 && audience !== '' && !create.isPending && !update.isPending;

  const save = () => {
    const body = {
      type: kind,
      title: title.trim(),
      month,
      day: dayClamped,
      isLunar,
      repeatsYearly,
      ...(repeatsYearly ? {} : { year }),
      remindDaysBefore: remind,
      theme: themeFor(kind),
      memberIds,
    };
    const familyId = audience === 'me' ? null : audience;
    const done = () => {
      toast.success(t('dates.form.saved'));
      goBack();
    };
    const failed = () => toast.failure(t('dates.form.saveFailed'));
    if (isEdit) {
      update.mutate(
        { familyId, id: params.id!, body },
        { onSuccess: done, onError: failed },
      );
    } else {
      create.mutate({ familyId, body }, { onSuccess: done, onError: failed });
    }
  };

  const onDelete = () => {
    if (!armedDelete) {
      setArmedDelete(true);
      return;
    }
    remove.mutate(
      {
        familyId: editing?.scope === 'PERSONAL' ? null : (editing?.familyId ?? null),
        id: params.id!,
      },
      {
        onSuccess: () => {
          toast.success(t('dates.form.deleted'));
          goBack();
        },
        onError: () => toast.failure(t('dates.form.saveFailed')),
      },
    );
  };

  return (
    <FormScreen
      onClose={goBack}
      title={t(isEdit ? 'dates.form.editTitle' : 'dates.form.title')}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label={t('dates.form.save')}
            variant="primary"
            size="large"
            fullWidth
            disabled={!canSave}
            loading={create.isPending || update.isPending}
            onPress={save}
          />
          {isEdit && (
            <Button
              label={t(armedDelete ? 'dates.form.deleteConfirm' : 'dates.form.delete')}
              variant="destructive"
              size="large"
              fullWidth
              loading={remove.isPending}
              onPress={onDelete}
            />
          )}
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: spacing.xl }}
      >
        {/* ---- loại ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('dates.form.kind')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {KINDS.map((value) => (
              <Pill
                key={value}
                label={t(KIND_LABEL_KEYS[value])}
                selected={kind === value}
                onPress={() => setKind(value)}
              />
            ))}
          </View>
        </View>

        {/* ---- tên ---- */}
        <TextField
          label={t('dates.form.name')}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          hint={title.trim() === '' ? t('dates.form.nameRequired') : undefined}
        />

        {/* ---- người ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('dates.form.who')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 10 }}
          >
            {/* Cả placeholder cũng chọn được — ngày giỗ nói về đúng những
                người không còn tài khoản. */}
            {members.map((member) => {
              const selected = memberIds.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() =>
                    setMemberIds((current) =>
                      selected
                        ? current.filter((id) => id !== member.id)
                        : [...current, member.id],
                    )
                  }
                  accessibilityRole="button"
                  style={{ width: 56, alignItems: 'center', gap: 5, opacity: selected ? 1 : 0.55 }}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: selected ? colors.coral.primary : 'transparent',
                      padding: 2,
                    }}
                  >
                    <Avatar size={44} name={member.displayName} mediaId={member.avatarKey} />
                  </View>
                  <Text
                    variant="badge"
                    weight={selected ? 'semibold' : 'regular'}
                    numberOfLines={1}
                  >
                    {member.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ---- ngày ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('dates.form.date')}
          </Text>
          <Card padding={spacing.lg}>
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label={t('dates.form.month')}
                    value={String(month)}
                    options={Array.from({ length: 12 }, (_, i) => ({
                      value: String(i + 1),
                      // dòng ÂM lịch: tháng là tháng ÂM — đánh số trần, không
                      // dùng tên tháng dương kẻo đọc thành lịch dương
                      label: isLunar
                        ? t('dates.form.lunarMonthN', { month: i + 1 })
                        : t(`date.months.${i + 1}`),
                    }))}
                    onChange={(v) => setMonth(Number(v))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label={t('dates.form.day')}
                    value={String(dayClamped)}
                    options={Array.from({ length: maxDay }, (_, i) => ({
                      value: String(i + 1),
                      label: String(i + 1),
                    }))}
                    onChange={(v) => setDay(Number(v))}
                  />
                </View>
                {!repeatsYearly && (
                  <View style={{ flex: 1 }}>
                    <SelectField
                      label={t('dates.form.year')}
                      value={String(year)}
                      options={Array.from({ length: 8 }, (_, i) => {
                        const y = now.getFullYear() + i;
                        return { value: String(y), label: String(y) };
                      })}
                      onChange={(v) => setYear(Number(v))}
                    />
                  </View>
                )}
              </View>
              <ToggleRow
                label={t('dates.form.lunar')}
                hint={
                  isLunar
                    ? t('dates.form.lunarHint', { month, day: dayClamped })
                    : undefined
                }
                value={isLunar}
                onChange={setIsLunar}
              />
              <ToggleRow
                label={t('dates.form.everyYear')}
                value={repeatsYearly}
                onChange={setRepeatsYearly}
              />
            </View>
          </Card>
        </View>

        {/* ---- ai thấy + nhắc ---- */}
        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('dates.form.whoSees')}
          </Text>
          <Card padding={spacing.lg}>
            <View style={{ gap: 14 }}>
              <SelectField
                label={t('dates.form.whoSees')}
                value={audience === '' ? 'me' : audience}
                options={audienceOptions}
                onChange={setAudience}
              />
              <SelectField
                label={audience === 'me' ? t('dates.form.remindMe') : t('dates.form.remind')}
                value={String(remind)}
                options={REMIND_CHOICES.map((n) => ({
                  value: String(n),
                  label:
                    n === 0
                      ? t('dates.form.remindOnDay')
                      : t('dates.form.remindDays', { count: n }),
                }))}
                onChange={(v) => setRemind(Number(v))}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </FormScreen>
  );
}
