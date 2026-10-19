import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import useStatsStore from "../store/statsStore";
import useBookStore from "../store/bookStore";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { ProgressBar } from "./BookCover";
import { haptics } from "../utils/haptics";
import {
  computeBadges,
  computeStreaks,
  countGoalDays,
  formatDuration,
  heatmapWeeks,
  lastNDays,
  totals as computeTotals,
} from "../utils/stats";

const HEAT_WEEKS = 17;
const GOAL_STEPS = [5, 10, 15, 20, 30, 50, 75, 100];

function nextGoal(goal: number, dir: 1 | -1): number {
  if (dir === 1) return GOAL_STEPS.find((g) => g > goal) ?? goal + 25;
  return (
    [...GOAL_STEPS].reverse().find((g) => g < goal) ?? Math.max(1, goal - 1)
  );
}

export default function StatsScreen() {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);
  const days = useStatsStore((s) => s.days);
  const dailyGoal = useStatsStore((s) => s.dailyGoal);
  const setDailyGoal = useStatsStore((s) => s.setDailyGoal);
  const finished = useStatsStore((s) => s.finished);
  const nightOwl = useStatsStore((s) => s.nightOwl);
  const earlyBird = useStatsStore((s) => s.earlyBird);
  const highlightCount = useBookStore((s) =>
    s.books.reduce((n, b) => n + (b.highlights?.length ?? 0), 0),
  );

  const streaks = useMemo(() => computeStreaks(days), [days]);
  const week = useMemo(() => lastNDays(days, 7), [days]);
  const heat = useMemo(() => heatmapWeeks(days, HEAT_WEEKS), [days]);
  const totals = useMemo(() => computeTotals(days), [days]);
  const badges = useMemo(
    () =>
      computeBadges({
        totals,
        streaks,
        booksFinished: finished.length,
        highlights: highlightCount,
        goalDaysHit: countGoalDays(days, dailyGoal),
        nightOwl,
        earlyBird,
      }),
    [
      totals,
      streaks,
      finished.length,
      highlightCount,
      days,
      dailyGoal,
      nightOwl,
      earlyBird,
    ],
  );

  const today = week[week.length - 1];
  const weekPages = week.reduce((n, d) => n + d.pages, 0);
  const weekSeconds = week.reduce((n, d) => n + d.seconds, 0);
  const maxWeek = Math.max(dailyGoal, ...week.map((d) => d.pages));
  const unlocked = badges.filter((b) => b.unlocked).length;

  const changeGoal = (dir: 1 | -1) => {
    haptics.tap();
    setDailyGoal(nextGoal(dailyGoal, dir));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Reading Stats</Text>

        {/* Streak */}
        <View style={[styles.card, styles.streakCard]}>
          <Text style={styles.streakEmoji}>
            {streaks.current > 0 ? "🔥" : "🌱"}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakValue}>
              {streaks.current} {streaks.current === 1 ? "day" : "days"}
            </Text>
            <Text style={styles.streakLabel}>
              {streaks.current === 0
                ? "Read a page today to start a streak"
                : streaks.readToday
                  ? "Streak secured for today ✨"
                  : "Read today to keep your streak alive!"}
            </Text>
          </View>
          <View style={styles.bestPill}>
            <Text style={styles.bestLabel}>BEST</Text>
            <Text style={styles.bestValue}>{streaks.best}</Text>
          </View>
        </View>

        {/* Today's goal */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Today&apos;s goal</Text>
            <View style={styles.goalAdjust}>
              <TouchableOpacity
                style={styles.goalBtn}
                onPress={() => changeGoal(-1)}
              >
                <Ionicons name="remove" size={16} color={c.primary} />
              </TouchableOpacity>
              <Text style={styles.goalValue}>{dailyGoal} pages</Text>
              <TouchableOpacity
                style={styles.goalBtn}
                onPress={() => changeGoal(1)}
              >
                <Ionicons name="add" size={16} color={c.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.goalNumbers}>
            <Text style={styles.goalBig}>{today.pages}</Text>
            <Text style={styles.goalOf}>/ {dailyGoal} pages</Text>
            <Text style={styles.goalTime}>{formatDuration(today.seconds)}</Text>
          </View>
          <ProgressBar
            value={today.pages / dailyGoal}
            color={today.pages >= dailyGoal ? c.success : c.primary}
            height={8}
          />
          {today.pages >= dailyGoal ? (
            <Text style={styles.goalDone}>
              🎯 Goal crushed! Anything more is a bonus.
            </Text>
          ) : null}
        </View>

        {/* This week */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>This week</Text>
            <Text style={styles.cardMeta}>
              {weekPages} pages · {formatDuration(weekSeconds)}
            </Text>
          </View>
          <View style={styles.chart}>
            <View
              style={[
                styles.goalLine,
                { bottom: (dailyGoal / maxWeek) * CHART_HEIGHT + 18 },
              ]}
              pointerEvents="none"
            />
            {week.map((d) => (
              <View key={d.key} style={styles.barCol}>
                <Text style={styles.barValue}>
                  {d.pages > 0 ? d.pages : ""}
                </Text>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (d.pages / maxWeek) * CHART_HEIGHT),
                      backgroundColor:
                        d.pages >= dailyGoal
                          ? c.success
                          : d.pages > 0
                            ? c.primary
                            : c.track,
                    },
                  ]}
                />
                <Text
                  style={[styles.barLabel, d.isToday && styles.barLabelToday]}
                >
                  {d.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Heatmap */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Activity</Text>
            <Text style={styles.cardMeta}>last {HEAT_WEEKS} weeks</Text>
          </View>
          <View style={styles.heatmap}>
            {heat.map((column, i) => (
              <View key={i} style={styles.heatCol}>
                {column.map((cell) => (
                  <View
                    key={cell.key}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: cell.future
                          ? "transparent"
                          : c.heat[cell.level],
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>Less</Text>
            {c.heat.map((color, i) => (
              <View
                key={i}
                style={[styles.heatCell, { backgroundColor: color }]}
              />
            ))}
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <Total
            icon="📄"
            value={totals.pages.toLocaleString()}
            label="pages read"
          />
          <Total
            icon="⏳"
            value={formatDuration(totals.seconds)}
            label="time reading"
          />
          <Total
            icon="🏁"
            value={String(finished.length)}
            label="books finished"
          />
          <Total
            icon="📅"
            value={String(totals.activeDays)}
            label="reading days"
          />
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Badges</Text>
            <Text style={styles.cardMeta}>
              {unlocked}/{badges.length} unlocked
            </Text>
          </View>
          <View style={styles.badges}>
            {badges.map((b) => (
              <View
                key={b.id}
                style={[styles.badge, !b.unlocked && styles.badgeLocked]}
              >
                <Text
                  style={[styles.badgeIcon, !b.unlocked && { opacity: 0.25 }]}
                >
                  {b.unlocked ? b.icon : "🔒"}
                </Text>
                <Text style={styles.badgeTitle} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>
                  {b.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {finished.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Finished shelf</Text>
            {[...finished]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 10)
              .map((f) => (
                <View key={f.bookId} style={styles.finishedRow}>
                  <Text style={styles.finishedTitle} numberOfLines={1}>
                    🏁 {f.title}
                  </Text>
                  <Text style={styles.cardMeta}>
                    {new Date(f.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Total({
  icon,
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.total}>
      <Text style={styles.totalIcon}>{icon}</Text>
      <Text style={styles.totalValue}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const CHART_HEIGHT = 110;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
      gap: spacing.md,
    },
    title: {
      fontSize: 30,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.5,
    },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    cardMeta: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },

    streakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: c.streakBg,
      borderColor: c.streakBorder,
    },
    streakEmoji: { fontSize: 44 },
    streakValue: { fontSize: 26, fontWeight: "800", color: c.streakTextStrong },
    streakLabel: { fontSize: 13, color: c.streakText, marginTop: 2 },
    bestPill: {
      alignItems: "center",
      backgroundColor: c.streakPill,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    bestLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: c.streakText,
      letterSpacing: 1,
    },
    bestValue: { fontSize: 20, fontWeight: "800", color: c.streakTextStrong },

    goalAdjust: { flexDirection: "row", alignItems: "center", gap: 8 },
    goalBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    goalValue: {
      fontSize: 13,
      fontWeight: "700",
      color: c.text,
      minWidth: 64,
      textAlign: "center",
    },
    goalNumbers: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    goalBig: { fontSize: 40, fontWeight: "800", color: c.text },
    goalOf: {
      fontSize: 15,
      color: c.textSecondary,
      marginLeft: 6,
      flex: 1,
    },
    goalTime: { fontSize: 14, color: c.textSecondary, fontWeight: "600" },
    goalDone: {
      marginTop: spacing.sm,
      fontSize: 13,
      color: c.success,
      fontWeight: "600",
    },

    chart: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: CHART_HEIGHT + 40,
      marginTop: spacing.md,
    },
    goalLine: {
      position: "absolute",
      left: 0,
      right: 0,
      borderTopWidth: 1,
      borderStyle: "dashed",
      borderColor: c.success,
      opacity: 0.6,
    },
    barCol: { flex: 1, alignItems: "center" },
    barValue: {
      fontSize: 10,
      color: c.textSecondary,
      marginBottom: 2,
      height: 13,
    },
    bar: { width: 22, borderRadius: 6 },
    barLabel: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 4,
      height: 14,
    },
    barLabelToday: { color: c.primary, fontWeight: "800" },

    heatmap: {
      flexDirection: "row",
      gap: 3,
      marginTop: spacing.md,
      justifyContent: "center",
    },
    heatCol: { gap: 3 },
    heatCell: { width: 14, height: 14, borderRadius: 3 },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      justifyContent: "flex-end",
      marginTop: spacing.sm,
    },
    legendText: {
      fontSize: 11,
      color: c.textSecondary,
      marginHorizontal: 4,
    },

    totals: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    total: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    totalIcon: { fontSize: 22 },
    totalValue: {
      fontSize: 22,
      fontWeight: "800",
      color: c.text,
      marginTop: 6,
    },
    totalLabel: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: spacing.sm,
      marginTop: spacing.md,
    },
    badge: {
      width: "31%",
      alignItems: "center",
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: c.accentSoft,
    },
    badgeLocked: { backgroundColor: c.background },
    badgeIcon: { fontSize: 28 },
    badgeTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: c.text,
      marginTop: 4,
    },
    badgeDesc: {
      fontSize: 10,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: 2,
    },

    finishedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    finishedTitle: { flex: 1, fontSize: 14, color: c.text },
  });
