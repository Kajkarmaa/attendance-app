import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, StyleProp, View, ViewStyle } from "react-native";

type Props = {
    style?: StyleProp<ViewStyle>;
    width?: number | string;
    height?: number;
    borderRadius?: number;
};

export default function SkeletonBlock({ style, width = "100%", height = 14, borderRadius = 6 }: Props) {
    const translate = useRef(new Animated.Value(0)).current;
    const [containerW, setContainerW] = useState(0);

    useEffect(() => {
        if (!containerW) return;
        translate.setValue(-containerW);
        Animated.loop(
            Animated.timing(translate, {
                toValue: containerW,
                duration: 900,
                useNativeDriver: true,
            }),
        ).start();
    }, [containerW]);

    const onLayout = (e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width);

    return (
        <View
            onLayout={onLayout}
            style={[
                {
                    width: typeof width === "string" ? width as any : width,
                    height,
                    borderRadius,
                    backgroundColor: "#E6E9EE",
                    overflow: "hidden"
                },
                style
            ]}
        >
            {containerW > 0 && (
                <Animated.View
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: Math.max(60, Math.floor(containerW * 0.6)),
                        transform: [{ translateX: translate }],
                    }}
                >
                    <LinearGradient
                        colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.6)", "rgba(255,255,255,0)"]}
                        start={[0, 0]}
                        end={[1, 0]}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            )}
        </View>
    );
}
