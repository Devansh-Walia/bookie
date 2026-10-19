import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { palette } from "../../constants/theme";
import { READER_THEMES } from "../../constants/readerThemes";
import type { ReaderTheme } from "../../types";

interface Props {
  visible: boolean;
  theme: ReaderTheme;
  haptics: boolean;
  onThemeChange: (theme: ReaderTheme) => void;
  onHapticsChange: (enabled: boolean) => void;
  onClose: () => void;
}

/** Bottom sheet with reading themes and reader preferences. */
export function ReaderSettingsModal({
  visible,
  theme,
  haptics,
  onThemeChange,
  onHapticsChange,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Reading theme</Text>
          <View style={styles.themes}>
            {READER_THEMES.map((t) => {
              const active = t.id === theme;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.theme, active && styles.themeActive]}
                  onPress={() => onThemeChange(t.id)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[styles.swatch, { backgroundColor: t.background }]}
                  >
                    <View
                      style={[styles.swatchPage, { backgroundColor: t.page }]}
                    >
                      <Text style={styles.swatchEmoji}>{t.emoji}</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.themeName, active && styles.themeNameActive]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Haptics</Text>
              <Text style={styles.rowSubtitle}>
                A gentle tap on every page turn
              </Text>
            </View>
            <Switch
              value={haptics}
              onValueChange={onHapticsChange}
              trackColor={{ true: palette.primary, false: palette.darkBorder }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.darkSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: palette.darkBorder,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.darkBorder,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.textOnDark,
    marginBottom: 14,
  },
  themes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  theme: {
    alignItems: "center",
    padding: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  themeActive: { borderColor: palette.accent },
  swatch: {
    width: 64,
    height: 80,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchPage: {
    width: 40,
    height: 54,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchEmoji: { fontSize: 18 },
  themeName: {
    marginTop: 6,
    fontSize: 12,
    color: palette.textOnDarkMuted,
    fontWeight: "600",
  },
  themeNameActive: { color: palette.textOnDark },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.darkBorder,
  },
  rowTitle: { fontSize: 15, fontWeight: "600", color: palette.textOnDark },
  rowSubtitle: { fontSize: 13, color: palette.textOnDarkMuted, marginTop: 2 },
});
