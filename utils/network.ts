import axios from "axios";

export type NetworkErrorKind =
    | "offline"
    | "timeout"
    | "server"
    | "unauthorized"
    | "forbidden"
    | "notFound"
    | "validation"
    | "rateLimited"
    | "unknown";

export interface ClassifiedNetworkError {
    kind: NetworkErrorKind;
    status?: number;
    message: string;
}

/**
 * Turn an axios / fetch error into a friendly bucket the UI can react to.
 * Lets dashboards show "You appear to be offline" vs. "Our server hiccuped"
 * vs. "Please log in again" with the same plumbing.
 */
export function classifyNetworkError(error: unknown): ClassifiedNetworkError {
    if (axios.isAxiosError(error)) {
        // No response means the request never made it back — almost always a
        // network problem (offline, DNS, server unreachable) or an aborted
        // request.
        if (!error.response) {
            if (error.code === "ECONNABORTED" || /timeout/i.test(error.message)) {
                return {
                    kind: "timeout",
                    message: "The request took too long. Check your connection and try again.",
                };
            }
            return {
                kind: "offline",
                message: "You appear to be offline. Check your internet connection.",
            };
        }

        const status = error.response.status;
        const serverMessage =
            (error.response.data as any)?.message ||
            (error.response.data as any)?.error;

        if (status === 401) {
            return {
                kind: "unauthorized",
                status,
                message: serverMessage || "Your session has expired. Please log in again.",
            };
        }
        if (status === 403) {
            return {
                kind: "forbidden",
                status,
                message: serverMessage || "You don't have permission to do that.",
            };
        }
        if (status === 404) {
            return {
                kind: "notFound",
                status,
                message: serverMessage || "The requested resource was not found.",
            };
        }
        if (status === 422 || status === 400) {
            return {
                kind: "validation",
                status,
                message: serverMessage || "Some of the submitted data is invalid.",
            };
        }
        if (status === 429) {
            return {
                kind: "rateLimited",
                status,
                message: serverMessage || "Too many requests. Please try again in a moment.",
            };
        }
        if (status >= 500) {
            return {
                kind: "server",
                status,
                message: serverMessage || "Our server hit a snag. Please try again shortly.",
            };
        }
        return {
            kind: "unknown",
            status,
            message: serverMessage || error.message,
        };
    }

    if (error instanceof Error) {
        return { kind: "unknown", message: error.message };
    }

    return { kind: "unknown", message: "Something went wrong." };
}
