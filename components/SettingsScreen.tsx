import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { AppLock } from "../modules/app-lock";
import useAppLockStore from "../store/appLockStore";
import useSettingsStore from "../store/settingsStore";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { READER_THEMES } from "../constants/readerThemes";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { haptics } from "../utils/haptics";
import type { AppThemeMode } from "../types";

const OPTIONS: {
  id: AppThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "system", label: "System", icon: "phone-portrait-outline" },
  { id: "light", label: "Light", icon: "sunny-outline" },
  { id: "dark", label: "Dark", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);
  const appTheme = useSettingsStore((s) => s.appTheme);
  const setAppTheme = useSettingsStore((s) => s.setAppTheme);
  const readerTheme = useSettingsStore((s) => s.readerTheme);
  const setReaderTheme = useSettingsStore((s) => s.setReaderTheme);
  const hapticsOn = useSettingsStore((s) => s.haptics);
  const setHaptics = useSettingsStore((s) => s.setHaptics);
  const lockedCount = useAppLockStore((s) => s.apps.length);
  const lockEnabled = useAppLockStore((s) => s.enabled);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appearance</Text>
          <View style={styles.row}>
            {OPTIONS.map((o) => {
              const active = appTheme === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    haptics.tap();
                    setAppTheme(o.id);
                  }}
                >
                  <Ionicons
                    name={o.icon}
                    size={22}
                    color={active ? c.primary : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.caption}>
            System follows your device setting.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reading</Text>
          <Text style={styles.label}>Default reader theme</Text>
          <View style={styles.row}>
            {READER_THEMES.map((t) => {
              const active = readerTheme === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    haptics.tap();
                    setReaderTheme(t.id);
                  }}
                >
                  <View style={[styles.swatch, { backgroundColor: t.page }]}>
                    <Text style={styles.emoji}>{t.emoji}</Text>
                  </View>
                  <Text
                    style={[
                      styles.optionLabel,
                      active && styles.optionLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.switchRow]}>
            <Text style={styles.label}>Haptics</Text>
            <Switch
              value={hapticsOn}
              onValueChange={setHaptics}
              trackColor={{ true: c.primary }}
            />
          </View>
        </View>

        {AppLock ? (
          <TouchableOpacity
            style={[styles.card, styles.linkCard]}
            onPress={() => router.push("/app-lock")}
          >
            <Ionicons name="lock-closed-outline" size={22} color={c.primary} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>App Lock</Text>
              <Text style={styles.caption}>
                {lockedCount === 0
                  ? "Read pages to unlock distracting apps."
                  : `${lockedCount} app${lockedCount === 1 ? "" : "s"} locked${lockEnabled ? "" : " · paused"}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.footer}>
          Bookie v{Constants.expoConfig?.version}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    title: { fontSize: 30, fontWeight: "800", color: c.text },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTitle: { fontSize: 18, fontWeight: "700", color: c.text },
    label: { fontSize: 15, fontWeight: "600", color: c.text },
    row: { flexDirection: "row", gap: 8 },
    option: {
      flex: 1,
      alignItems: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    optionActive: { borderColor: c.primary, backgroundColor: c.accentSoft },
    optionLabel: { fontSize: 12, color: c.textSecondary },
    optionLabelActive: { color: c.text, fontWeight: "700" },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: { fontSize: 16 },
    caption: { fontSize: 12, color: c.textMuted },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    linkCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    flex: { flex: 1 },
    footer: { textAlign: "center", color: c.textMuted, fontSize: 12 },
  });
