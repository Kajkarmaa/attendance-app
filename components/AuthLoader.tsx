import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

const DOT_COUNT = 3;
const DOT_DURATION = 420;
const DOT_STAGGER = 140;

function Dot({ index, color }: { index: number; color: string }) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            index * DOT_STAGGER,
            withRepeat(
                withSequence(
                    withTiming(1, {
                        duration: DOT_DURATION,
                        easing: Easing.out(Easing.quad),
                    }),
                    withTiming(0, {
                        duration: DOT_DURATION,
                        easing: Easing.in(Easing.quad),
                    }),
                ),
                -1,
                false,
            ),
        );
        return () => cancelAnimation(progress);
    }, [index, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: 0.35 + progress.value * 0.65,
        transform: [
            { translateY: -progress.value * 8 },
            { scale: 0.85 + progress.value * 0.25 },
        ],
    }));

    return (
        <Animated.View
            style={[styles.dot, { backgroundColor: color }, animatedStyle]}
        />
    );
}

const BACKGROUND = "#ffffff";
const TITLE_COLOR = "#11181C";
const SUBTITLE_COLOR = "#687076";
const DOT_COLOR = "#D4A637";

export default function AuthLoader() {
    return (
        <View
            style={styles.container}
            onLayout={() => {
                SplashScreen.hideAsync().catch(() => {});
            }}
        >
            <Image
                source={require("@/assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
            />

            <View style={styles.dotsRow}>
                {Array.from({ length: DOT_COUNT }).map((_, i) => (
                    <Dot key={i} index={i} color={DOT_COLOR} />
                ))}
            </View>
            <Text style={styles.subtitle}>
                Wait we are preparing your screen...
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: BACKGROUND,
    },
    logo: {
        width: 200,
        height: 200,
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: "600",
        letterSpacing: 0.3,
        marginBottom: 32,
        color: TITLE_COLOR,
    },
    dotsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 18,
        marginBottom: 16,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: 5,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "500",
        color: SUBTITLE_COLOR,
    },
});
