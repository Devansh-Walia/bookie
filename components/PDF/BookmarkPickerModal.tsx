import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { palette } from "../../constants/theme";

export const BOOKMARK_ICONS = [
  "🔖", "📌", "⭐", "❤️", "💡", "❗", "📖", "🏷️",
  "🔥", "✅", "🎯", "📝", "💬", "🧠", "🚩", "✨",
];

interface Props {
  visible: boolean;
  icon: string;
  label: string;
  onIconChange: (icon: string) => void;
  onLabelChange: (label: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function BookmarkPickerModal({
  visible,
  icon,
  label,
  onIconChange,
  onLabelChange,
  onCancel,
  onSave,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Add bookmark</Text>
          <Text style={styles.subtitle}>Pick an icon and label</Text>

          <View style={styles.iconGrid}>
            {BOOKMARK_ICONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.iconCell, icon === emoji && styles.iconCellActive]}
                onPress={() => onIconChange(emoji)}
              >
                <Text style={styles.iconEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Label (optional)"
            placeholderTextColor="#94A3B8"
            value={label}
            onChangeText={onLabelChange}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.ghostButton} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={onSave}>
              <Text style={styles.primaryButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: palette.darkSurface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.darkBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.textOnDark,
  },
  subtitle: {
    fontSize: 14,
    color: palette.textOnDarkMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.darkSurfaceAlt,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconCellActive: {
    borderColor: palette.accent,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  iconEmoji: {
    fontSize: 24,
  },
  input: {
    backgroundColor: palette.darkSurfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.textOnDark,
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.darkBorder,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  ghostButtonText: {
    color: palette.textOnDarkMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});