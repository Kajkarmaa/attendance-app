const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args: unknown[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: unknown[]) => {
        if (isDev) {
            console.error(...args);
        }
    },
};
