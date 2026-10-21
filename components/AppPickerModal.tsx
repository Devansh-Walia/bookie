import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import type { InstalledApp } from "../modules/app-lock";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { haptics } from "../utils/haptics";

interface Props {
  visible: boolean;
  apps: InstalledApp[] | null;
  /** Packages already locked; shown as checked and not selectable. */
  locked: Set<string>;
  onClose: () => void;
  onAdd: (apps: InstalledApp[]) => void;
}

/** Searchable multi-select list of installed apps. */
export function AppPickerModal({
  visible,
  apps,
  locked,
  onClose,
  onAdd,
}: Props) {
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = apps ?? [];
    return q ? list.filter((a) => a.label.toLowerCase().includes(q)) : list;
  }, [apps, query]);

  const close = () => {
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const toggle = (pkg: string) => {
    haptics.tap();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });
  };

  const add = () => {
    onAdd((apps ?? []).filter((a) => selected.has(a.packageName)));
    close();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose apps</Text>
          <TouchableOpacity
            onPress={add}
            disabled={selected.size === 0}
            hitSlop={10}
          >
            <Text
              style={[styles.add, selected.size === 0 && styles.addDisabled]}
            >
              Add{selected.size ? ` (${selected.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search apps"
            placeholderTextColor={c.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        {apps === null ? (
          <Text style={styles.empty}>Loading apps…</Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(a) => a.packageName}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={
              <Text style={styles.empty}>No apps match “{query}”.</Text>
            }
            renderItem={({ item }) => {
              const isLocked = locked.has(item.packageName);
              const checked = isLocked || selected.has(item.packageName);
              return (
                <Pressable
                  style={styles.row}
                  disabled={isLocked}
                  onPress={() => toggle(item.packageName)}
                >
                  {item.icon ? (
                    <Image source={{ uri: item.icon }} style={styles.icon} />
                  ) : (
                    <View style={[styles.icon, styles.iconFallback]} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.label} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {isLocked ? (
                      <Text style={styles.sub}>Already locked</Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={checked ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={
                      isLocked ? c.textMuted : checked ? c.primary : c.border
                    }
                  />
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    title: { fontSize: 17, fontWeight: "700", color: c.text },
    cancel: { fontSize: 16, color: c.textSecondary },
    add: { fontSize: 16, fontWeight: "700", color: c.primary },
    addDisabled: { color: c.textMuted },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: c.text },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    icon: { width: 40, height: 40, borderRadius: 10 },
    iconFallback: { backgroundColor: c.coverPlaceholder },
    rowText: { flex: 1 },
    label: { fontSize: 15, fontWeight: "600", color: c.text },
    sub: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    empty: {
      textAlign: "center",
      color: c.textMuted,
      marginTop: spacing.xl,
    },
  });
