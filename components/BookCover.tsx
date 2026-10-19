import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import type { Book } from "../types";
import type { AppColors } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { coverFile } from "../utils/files";

const ACCENTS = [
  "#6366F1",
  "#8B5CF6",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#F43F5E",
];

export function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

export function progressOf(book: Book): number {
  if (book.finishedAt) return 1;
  if (!book.totalPages) return 0;
  return Math.min(1, Math.max(0, book.currentPage / book.totalPages));
}

interface Props {
  book: Book;
  width: number;
  style?: ViewStyle;
}

/** Book cover: the rendered first page, or a generated "cloth" cover. */
export function BookCover({ book, width, style }: Props) {
  const styles = useThemedStyles(makeStyles);
  const height = Math.round(width * 1.4);
  const radius = Math.max(4, Math.round(width * 0.05));
  const frame = { width, height, borderRadius: radius };

  if (book.coverFileName) {
    return (
      <View style={[styles.shadow, frame, style]}>
        <Image
          source={{ uri: coverFile(book.coverFileName).uri }}
          style={[frame, styles.image]}
          resizeMode="cover"
        />
        <View
          style={[
            styles.spine,
            { borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
          ]}
        />
        {book.finishedAt ? <FinishedRibbon size={width} /> : null}
      </View>
    );
  }

  const accent = accentForId(book.id);
  return (
    <View style={[styles.shadow, frame, { backgroundColor: accent }, style]}>
      <View style={[styles.placeholderInner, { borderRadius: radius }]}>
        <Text
          style={[
            styles.placeholderTitle,
            { fontSize: Math.max(10, width * 0.11) },
          ]}
          numberOfLines={4}
        >
          {book.title}
        </Text>
        {book.coverStatus === "pending" ? (
          <Text style={styles.placeholderHint}>✨</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.spine,
          { borderTopLeftRadius: radius, borderBottomLeftRadius: radius },
        ]}
      />
      {book.finishedAt ? <FinishedRibbon size={width} /> : null}
    </View>
  );
}

function FinishedRibbon({ size }: { size: number }) {
  const styles = useThemedStyles(makeStyles);
  const badge = Math.max(18, Math.round(size * 0.22));
  return (
    <View
      style={[
        styles.finished,
        {
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          top: badge * 0.25,
          right: badge * 0.25,
        },
      ]}
    >
      <Text
        style={{ fontSize: badge * 0.55, color: "#fff", fontWeight: "800" }}
      >
        ✓
      </Text>
    </View>
  );
}

export function ProgressBar({
  value,
  color,
  height = 4,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? c.primary,
        }}
      />
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    shadow: {
      backgroundColor: c.coverPlaceholder,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    image: { backgroundColor: "#fff" },
    spine: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 6,
      backgroundColor: "rgba(0,0,0,0.12)",
    },
    placeholderInner: {
      flex: 1,
      margin: 6,
      marginLeft: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      padding: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderTitle: {
      color: "#fff",
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: 0.2,
    },
    placeholderHint: {
      position: "absolute",
      bottom: 6,
      right: 6,
      fontSize: 12,
    },
    finished: {
      position: "absolute",
      backgroundColor: "#10B981",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
    track: { width: "100%", backgroundColor: c.track, overflow: "hidden" },
  });
