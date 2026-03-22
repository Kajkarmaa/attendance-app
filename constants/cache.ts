export const CACHE_TTL = {
    ATTENDANCE: 2 * 60 * 1000,
    LISTS: 2 * 60 * 1000,
    LEAVE_BALANCE: 5 * 60 * 1000,
    PROFILE: 5 * 60 * 1000,
    POLICIES: 15 * 60 * 1000,
    IMAGE: 15 * 60 * 1000,
} as const;

export const DEFAULT_CACHE_TTL = CACHE_TTL.PROFILE;
