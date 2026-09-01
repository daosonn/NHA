import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { specialDates } from '../../lib/api';
import type {
  CreateSpecialDateRequest,
  MySpecialDateItem,
  UpdateSpecialDateRequest,
} from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Item của feed "Dates we keep" sau chuẩn hoá — không màn nào phải hỏi
 *  `undefined` nghĩa là gì nữa (server cũ chưa gửi các field mới).
 *  Omit trước khi & — intersection của `number | undefined` (kiểu gốc) với
 *  `number | null` sẽ thu về `number` và cấm mất chính giá trị null. */
export type MyDateItem = Omit<
  MySpecialDateItem,
  'id' | 'isLunar' | 'repeatsYearly' | 'remindDaysBefore'
> & {
  id: string | null;
  isLunar: boolean;
  repeatsYearly: boolean;
  remindDaysBefore: number | null;
};

function normalize(item: MySpecialDateItem): MyDateItem {
  return {
    ...item,
    id: item.id ?? null,
    isLunar: item.isLunar ?? false,
    repeatsYearly: item.repeatsYearly ?? true,
    remindDaysBefore: item.remindDaysBefore ?? null,
    familyName: item.familyName ?? null,
  };
}

/** Mọi ngày sắp tới người này thấy — xuyên mọi nhà + "Only me" (12a/12b/12d). */
export function useMyDates() {
  return useQuery({
    queryKey: queryKeys.myDates(),
    queryFn: () => specialDates.mine(50),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items.map(normalize),
  });
}

/**
 * Bộ invalidate chung của cả ba mutation: `myDates` nuôi 12a/12b/12d, còn
 * `specialDates(familyId)` nuôi Home EventWidget + AI hub "Coming up" +
 * OccasionSheet — staleTime 5 phút nên thiếu nó là ba chỗ kia trưng ngày cũ
 * suốt 5 phút sau khi lưu.
 */
function useInvalidateDates() {
  const queryClient = useQueryClient();
  return (familyId: string | null) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.myDates() });
    if (familyId !== null) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.specialDates(familyId),
      });
    }
  };
}

/** familyId null = tạo dòng "Only me". */
export function useCreateDate() {
  const invalidate = useInvalidateDates();
  return useMutation({
    mutationFn: ({
      familyId,
      body,
    }: {
      familyId: string | null;
      body: CreateSpecialDateRequest;
    }) =>
      familyId !== null
        ? specialDates.create(familyId, body)
        : specialDates.createMine(body),
    onSuccess: (_detail, vars) => invalidate(vars.familyId),
  });
}

export function useUpdateDate() {
  const invalidate = useInvalidateDates();
  return useMutation({
    mutationFn: ({
      familyId,
      id,
      body,
    }: {
      familyId: string | null;
      id: string;
      body: UpdateSpecialDateRequest;
    }) =>
      familyId !== null
        ? specialDates.update(familyId, id, body)
        : specialDates.updateMine(id, body),
    onSuccess: (_detail, vars) => invalidate(vars.familyId),
  });
}

export function useDeleteDate() {
  const invalidate = useInvalidateDates();
  return useMutation({
    mutationFn: ({ familyId, id }: { familyId: string | null; id: string }) =>
      familyId !== null
        ? specialDates.remove(familyId, id)
        : specialDates.removeMine(id),
    onSuccess: (_res, vars) => invalidate(vars.familyId),
  });
}
