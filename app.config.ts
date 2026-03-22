export default ({ config }: { config: Record<string, any> }) => ({
    ...config,
    extra: {
        ...(config.extra ?? {}),
        apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    },
});
