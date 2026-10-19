import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useThemedStyles } from "../hooks/useAppTheme";

export interface ToastMessage {
  id: number;
  title: string;
  subtitle?: string;
}

/** Small celebratory banner shown after closing the reader. */
export function SessionToast({
  message,
  onHide,
}: {
  message: ToastMessage | null;
  onHide: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    anim.setValue(0);
    const seq = Animated.sequence([
      Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);
    seq.start(({ finished }) => finished && onHide());
    return () => seq.stop();
  }, [message, anim, onHide]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.title}>{message.title}</Text>
      {message.subtitle ? (
        <Text style={styles.subtitle}>{message.subtitle}</Text>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    toast: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.lg,
      backgroundColor: c.inverse,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    title: { color: c.onInverse, fontSize: 16, fontWeight: "700" },
    subtitle: { color: c.onInverseMuted, fontSize: 13, marginTop: 2 },
  });
