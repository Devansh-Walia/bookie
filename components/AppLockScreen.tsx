import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { AppLock, type InstalledApp } from "../modules/app-lock";
import useAppLockStore from "../store/appLockStore";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { useAppLockStatus, useLockProgress } from "../hooks/useAppLock";
import {
  clampTier,
  MAX_TIERS,
  PASS_MINUTES,
  PASSES_PER_DAY,
  unlockedTierCount,
} from "../utils/appLock";
import { haptics } from "../utils/haptics";
import { AppPickerModal } from "./AppPickerModal";

const STEP = 5;

export default function AppLockScreen() {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);

  const enabled = useAppLockStore((s) => s.enabled);
  const setEnabled = useAppLockStore((s) => s.setEnabled);
  const tiers = useAppLockStore((s) => s.tiers);
  const setTierPages = useAppLockStore((s) => s.setTierPages);
  const addTier = useAppLockStore((s) => s.addTier);
  const removeTier = useAppLockStore((s) => s.removeTier);
  const apps = useAppLockStore((s) => s.apps);
  const addApps = useAppLockStore((s) => s.addApps);
  const removeApp = useAppLockStore((s) => s.removeApp);
  const setAppTier = useAppLockStore((s) => s.setAppTier);
  const lockTier = useAppLockStore((s) => s.lockTier);

  const { thresholds, pages } = useLockProgress();
  const unlocked = unlockedTierCount(thresholds, pages);
  const { serviceEnabled, cheats, refresh } = useAppLockStatus();

  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useFocusEffect(refresh);

  useEffect(() => {
    AppLock?.getInstalledApps()
      .then(setInstalled)
      .catch(() => setInstalled([]));
  }, []);

  const icons = useMemo(
    () => new Map((installed ?? []).map((a) => [a.packageName, a.icon])),
    [installed],
  );
  const lockedSet = useMemo(
    () => new Set(apps.map((a) => a.packageName)),
    [apps],
  );

  const confirmRelock = useCallback(
    (tier: number) => {
      const above = tier < tiers.length - 1 ? " and every tier above it" : "";
      Alert.alert(
        `Re-lock tier ${tier + 1}?`,
        `This locks tier ${tier + 1}${above} again. You'll need to read ${tiers[tier]} pages to unlock it.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Re-lock",
            style: "destructive",
            onPress: () => {
              haptics.success();
              lockTier(tier);
            },
          },
        ],
      );
    },
    [tiers, lockTier],
  );

  if (!AppLock) {
    return (
      <View style={[styles.content, styles.safe]}>
        <Text style={styles.caption}>
          App Lock needs the Android build of Bookie.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      {!serviceEnabled ? (
        <View style={[styles.card, styles.warnCard]}>
          <View style={styles.rowGap}>
            <Ionicons name="warning-outline" size={20} color={c.warning} />
            <Text style={styles.cardTitle}>Turn on the App Lock service</Text>
          </View>
          <Text style={styles.body}>
            Bookie needs Accessibility access to notice when you open a locked
            app. It never reads what&apos;s on screen or what you type.
          </Text>
          <Text style={styles.body}>
            Settings → Accessibility → Installed apps → Bookie App Lock → On.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => AppLock?.openAccessibilitySettings()}
          >
            <Text style={styles.primaryBtnText}>
              Open Accessibility settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => AppLock?.openAppSettings()}>
            <Text style={styles.link}>
              Option greyed out? Open App info → ⋮ → Allow restricted settings
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Lock apps</Text>
            <Text style={styles.caption}>
              Read to unlock apps for the rest of the day. Everything locks
              again at midnight.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              haptics.tap();
              setEnabled(v);
            }}
            trackColor={{ true: c.primary }}
          />
        </View>
      </View>

      {/* Tiers + today's progress */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Tiers</Text>
          <Text style={styles.meta}>{pages} pages counted today</Text>
        </View>
        {tiers.map((inc, i) => {
          const start = i === 0 ? 0 : thresholds[i - 1];
          const isUnlocked = i < unlocked;
          const progress = Math.min(
            1,
            Math.max(0, (pages - start) / Math.max(1, inc)),
          );
          return (
            <View key={i} style={styles.tier}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGap}>
                  <Ionicons
                    name={isUnlocked ? "lock-open" : "lock-closed"}
                    size={16}
                    color={isUnlocked ? c.success : c.textSecondary}
                  />
                  <Text style={styles.label}>Tier {i + 1}</Text>
                </View>
                <View style={styles.rowGap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setTierPages(i, inc - STEP)}
                  >
                    <Ionicons name="remove" size={16} color={c.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>
                    {i === 0 ? "" : "+"}
                    {inc} pages
                  </Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setTierPages(i, inc + STEP)}
                  >
                    <Ionicons name="add" size={16} color={c.primary} />
                  </TouchableOpacity>
                  {tiers.length > 1 ? (
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => removeTier(i)}
                      accessibilityLabel={`Remove tier ${i + 1}`}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={c.textMuted}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: isUnlocked ? c.success : c.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.caption}>
                  {isUnlocked
                    ? "Unlocked for today"
                    : `${thresholds[i] - pages} more pages · unlocks at ${thresholds[i]}`}
                </Text>
                {isUnlocked ? (
                  <TouchableOpacity onPress={() => confirmRelock(i)}>
                    <Text style={styles.link}>Re-lock</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })}
        {tiers.length < MAX_TIERS ? (
          <TouchableOpacity style={styles.ghostBtn} onPress={addTier}>
            <Ionicons name="add" size={18} color={c.primary} />
            <Text style={styles.ghostBtnText}>Add tier</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Locked apps */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Locked apps</Text>
        {apps.length === 0 ? (
          <Text style={styles.caption}>
            No apps locked yet. New apps start in tier 1.
          </Text>
        ) : null}
        {apps.map((app) => {
          const tier = clampTier(app.tier, tiers.length);
          const icon = icons.get(app.packageName);
          const open = tier < unlocked;
          return (
            <View key={app.packageName} style={styles.app}>
              <View style={styles.rowBetween}>
                <View style={[styles.rowGap, styles.flex]}>
                  {icon ? (
                    <Image source={{ uri: icon }} style={styles.appIcon} />
                  ) : (
                    <View style={[styles.appIcon, styles.iconFallback]} />
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.label} numberOfLines={1}>
                      {app.label}
                    </Text>
                    <Text style={styles.caption}>
                      {open
                        ? "Unlocked today"
                        : `${thresholds[tier] - pages} more pages`}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  hitSlop={8}
                  onPress={() => removeApp(app.packageName)}
                  accessibilityLabel={`Unlock ${app.label} permanently`}
                >
                  <Ionicons name="close-circle" size={22} color={c.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {tiers.map((_, i) => {
                  const active = i === tier;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => {
                        haptics.tap();
                        setAppTier(app.packageName, i);
                      }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        Tier {i + 1} · {thresholds[i]}p
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => setPickerOpen(true)}
        >
          <Ionicons name="apps-outline" size={18} color={c.primary} />
          <Text style={styles.ghostBtnText}>Add apps</Text>
        </TouchableOpacity>
      </View>

      {/* Cheats */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cheat passes</Text>
        <Text style={styles.caption}>
          From the lock screen you can open an app for {PASS_MINUTES} minutes
          without reading, {PASSES_PER_DAY} times a day. Every pass is counted.
        </Text>
        <View style={styles.statsRow}>
          <Stat
            value={`${cheats?.passesLeft ?? PASSES_PER_DAY}/${PASSES_PER_DAY}`}
            label="left today"
          />
          <Stat value={String(cheats?.today ?? 0)} label="used today" />
          <Stat value={String(cheats?.total ?? 0)} label="all time" />
        </View>
      </View>

      <AppPickerModal
        visible={pickerOpen}
        apps={installed}
        locked={lockedSet}
        onClose={() => setPickerOpen(false)}
        onAdd={(picked) =>
          addApps(
            picked.map((a) => ({ packageName: a.packageName, label: a.label })),
          )
        }
      />
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    flex: { flex: 1 },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    warnCard: { borderColor: c.warning },
    cardTitle: { fontSize: 18, fontWeight: "700", color: c.text },
    label: { fontSize: 15, fontWeight: "600", color: c.text },
    body: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
    caption: { fontSize: 12, color: c.textMuted },
    meta: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },
    link: { fontSize: 13, color: c.primary, fontWeight: "600" },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
    primaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: spacing.xs,
    },
    primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
    ghostBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: c.border,
      marginTop: spacing.xs,
    },
    ghostBtnText: { color: c.primary, fontWeight: "700" },
    tier: {
      gap: 6,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stepValue: {
      fontSize: 13,
      fontWeight: "700",
      color: c.text,
      minWidth: 72,
      textAlign: "center",
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.track,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: 3 },
    app: {
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    appIcon: { width: 36, height: 36, borderRadius: 9 },
    iconFallback: { backgroundColor: c.coverPlaceholder },
    chips: { gap: 6 },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    chipActive: { borderColor: c.primary, backgroundColor: c.accentSoft },
    chipText: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },
    chipTextActive: { color: c.text },
    statsRow: { flexDirection: "row", marginTop: spacing.xs },
    stat: { flex: 1, alignItems: "center" },
    statValue: { fontSize: 22, fontWeight: "800", color: c.text },
  });
