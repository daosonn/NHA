import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useFamilies } from './use-families';

/** Which family is on screen. A preference, not a secret — `AsyncStorage` is right. */
const STORAGE_KEY = 'nha.family.active';

type ActiveFamilyValue = {
  /** `null` while families are loading, and for an account with none yet. */
  familyId: string | null;
  setFamilyId: (familyId: string) => void;
};

const ActiveFamilyContext = createContext<ActiveFamilyValue | null>(null);

/**
 * The one piece of state that genuinely spans screens.
 *
 * Home's group strip, the family tree and the audience picker on New moment
 * all need to agree on which family is being looked at. That is the whole
 * requirement — which is why this is a context and not a store: `zustand`
 * was considered and left out until there is a second such value
 * (`architecture.md` § State).
 *
 * The stored id is a hint, not the truth. It is only honoured while it still
 * names a family the person belongs to; leaving a family, or signing in as
 * someone else, falls back to the first one rather than showing an empty
 * screen for a family that is no longer theirs.
 */
export function ActiveFamilyProvider({ children }: { children: React.ReactNode }) {
  const { data: families } = useFamilies();
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!cancelled && value !== null) setStored(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setFamilyId = useCallback((familyId: string) => {
    setStored(familyId);
    void AsyncStorage.setItem(STORAGE_KEY, familyId);
  }, []);

  const familyId = useMemo(() => {
    if (families === undefined || families.length === 0) return null;
    if (stored !== null && families.some((family) => family.id === stored)) return stored;
    return families[0].id;
  }, [families, stored]);

  const value = useMemo(() => ({ familyId, setFamilyId }), [familyId, setFamilyId]);

  return <ActiveFamilyContext.Provider value={value}>{children}</ActiveFamilyContext.Provider>;
}

export function useActiveFamily(): ActiveFamilyValue {
  const value = useContext(ActiveFamilyContext);

  if (value === null) {
    throw new Error('useActiveFamily must be used inside an ActiveFamilyProvider');
  }

  return value;
}
