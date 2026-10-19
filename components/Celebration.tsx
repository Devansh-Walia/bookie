import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useThemedStyles } from "../hooks/useAppTheme";

const COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#0EA5E9",
  "#F43F5E",
  "#FACC15",
];
const PIECES = 70;

function ConfettiPiece({
  index,
  height,
  width,
}: {
  index: number;
  height: number;
  width: number;
}) {
  const fall = useRef(new Animated.Value(0)).current;
  const config = useMemo(
    () => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 160,
      delay: Math.random() * 600,
      duration: 2200 + Math.random() * 1800,
      size: 6 + Math.random() * 8,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
      color: COLORS[index % COLORS.length],
      round: Math.random() > 0.6,
    }),
    [index, width],
  );

  useEffect(() => {
    Animated.timing(fall, {
      toValue: 1,
      duration: config.duration,
      delay: config.delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [fall, config]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: config.x,
        top: -20,
        width: config.size,
        height: config.round ? config.size : config.size * 0.45,
        borderRadius: config.round ? config.size / 2 : 2,
        backgroundColor: config.color,
        opacity: fall.interpolate({
          inputRange: [0, 0.85, 1],
          outputRange: [1, 1, 0],
        }),
        transform: [
          {
            translateY: fall.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height + 40],
            }),
          },
          {
            translateX: fall.interpolate({
              inputRange: [0, 1],
              outputRange: [0, config.drift],
            }),
          },
          {
            rotate: fall.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${config.spin}deg`],
            }),
          },
        ],
      }}
    />
  );
}

export function Confetti({ burstKey }: { burstKey: number }) {
  const { width, height } = Dimensions.get("window");
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} key={burstKey}>
      {Array.from({ length: PIECES }, (_, i) => (
        <ConfettiPiece key={i} index={i} width={width} height={height} />
      ))}
    </View>
  );
}

interface CelebrationProps {
  visible: boolean;
  title: string;
  totalPages: number;
  booksFinished: number;
  onClose: () => void;
}

/** Full-screen "you finished a book" moment. */
export function Celebration({
  visible,
  title,
  totalPages,
  booksFinished,
  onClose,
}: CelebrationProps) {
  const styles = useThemedStyles(makeStyles);
  const pop = useRef(new Animated.Value(0)).current;
  // New confetti burst each time the modal opens (but not on re-renders).
  const burstKey = useMemo(() => (visible ? Date.now() : 0), [visible]);

  useEffect(() => {
    if (!visible) return;
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [visible, pop]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {visible ? <Confetti burstKey={burstKey} /> : null}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  scale: pop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
              opacity: pop,
            },
          ]}
        >
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.heading}>You finished it!</Text>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.statsRow}>
            {totalPages > 0 ? (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{totalPages}</Text>
                <Text style={styles.statLabel}>pages</Text>
              </View>
            ) : null}
            <View style={styles.stat}>
              <Text style={styles.statValue}>{booksFinished}</Text>
              <Text style={styles.statLabel}>
                {booksFinished === 1 ? "book finished" : "books finished"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Woohoo! 🎉</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.75)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: c.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      alignItems: "center",
    },
    trophy: { fontSize: 64, marginBottom: spacing.sm },
    heading: { fontSize: 26, fontWeight: "800", color: c.text },
    bookTitle: {
      fontSize: 16,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: spacing.xs,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.lg,
      marginVertical: spacing.lg,
    },
    stat: { alignItems: "center" },
    statValue: { fontSize: 24, fontWeight: "800", color: c.primary },
    statLabel: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    button: {
      backgroundColor: c.primary,
      borderRadius: radius.pill,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  });
