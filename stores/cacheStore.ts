import { create } from "zustand";

type CacheEntry<T = unknown> = {
    data: T;
    updatedAt: number;
};

type CacheState = {
    entries: Record<string, CacheEntry>;
    setEntry: <T>(key: string, data: T) => void;
    clearEntry: (key: string) => void;
    clearAll: () => void;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const useCacheStore = create<CacheState>((set) => ({
    entries: {},
    setEntry: (key, data) =>
        set((state) => ({
            entries: {
                ...state.entries,
                [key]: {
                    data,
                    updatedAt: Date.now(),
                },
            },
        })),
    clearEntry: (key) =>
        set((state) => {
            const next = { ...state.entries };
            delete next[key];
            return { entries: next };
        }),
    clearAll: () => set({ entries: {} }),
}));

export const getCachedData = <T>(
    key: string,
    ttlMs: number = DEFAULT_TTL_MS,
): T | null => {
    const entry = useCacheStore.getState().entries[key];
    if (!entry) {
        return null;
    }
    if (Date.now() - entry.updatedAt > ttlMs) {
        return null;
    }
    return entry.data as T;
};

export const setCachedData = <T>(key: string, data: T) => {
    useCacheStore.getState().setEntry(key, data);
};

export const invalidateCache = (key: string) => {
    useCacheStore.getState().clearEntry(key);
};
