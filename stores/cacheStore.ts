import { DEFAULT_CACHE_TTL } from "@/constants/cache";
import { create } from "zustand";

type CacheEntry<T = unknown> = {
    data: T;
    updatedAt: number;
    ttlMs: number;
};

type CacheState = {
    entries: Record<string, CacheEntry>;
    setEntry: <T>(key: string, data: T, ttlMs: number) => void;
    clearEntry: (key: string) => void;
    clearAll: () => void;
};

export const useCacheStore = create<CacheState>((set) => ({
    entries: {},
    setEntry: (key, data, ttlMs) =>
        set((state) => ({
            entries: {
                ...state.entries,
                [key]: {
                    data,
                    updatedAt: Date.now(),
                    ttlMs,
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

export const getCachedData = <T>(key: string): T | null => {
    const entry = useCacheStore.getState().entries[key];
    if (!entry) {
        return null;
    }
    if (Date.now() - entry.updatedAt > entry.ttlMs) {
        useCacheStore.getState().clearEntry(key);
        return null;
    }
    return entry.data as T;
};

export const setCachedData = <T>(
    key: string,
    data: T,
    ttlMs: number = DEFAULT_CACHE_TTL,
) => {
    useCacheStore.getState().setEntry(key, data, ttlMs);
};

export const invalidateCache = (key: string) => {
    useCacheStore.getState().clearEntry(key);
};

export const purgeExpiredCache = () => {
    const { entries, clearEntry } = useCacheStore.getState();
    const now = Date.now();
    Object.entries(entries).forEach(([key, entry]) => {
        if (now - entry.updatedAt > entry.ttlMs) {
            clearEntry(key);
        }
    });
};
