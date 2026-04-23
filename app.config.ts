export default ({ config }: { config: Record<string, any> }) => ({
    ...config,
    android: {
        ...(config.android ?? {}),
        config: {
            ...(config.android?.config ?? {}),
            googleMaps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY,
            },
        },
    },
    extra: {
        ...(config.extra ?? {}),
        apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    },
});
