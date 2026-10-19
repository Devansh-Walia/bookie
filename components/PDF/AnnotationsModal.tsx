import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../../constants/theme";
import { Bookmark, Highlight } from "../../types";

interface Props {
  visible: boolean;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  onClose: () => void;
  onJump: (page: number) => void;
  onRemoveBookmark: (id: string) => void;
  onRemoveHighlight: (id: string) => void;
}

export function AnnotationsModal({
  visible,
  bookmarks,
  highlights,
  onClose,
  onJump,
  onRemoveBookmark,
  onRemoveHighlight,
}: Props) {
  const sortedBookmarks = [...bookmarks].sort((a, b) => a.page - b.page);
  const sortedHighlights = [...highlights].sort((a, b) => a.page - b.page);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Annotations</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.sectionTitle}>Bookmarks</Text>
            {sortedBookmarks.length === 0 ? (
              <Text style={styles.empty}>No bookmarks yet.</Text>
            ) : (
              sortedBookmarks.map((b) => (
                <View key={b.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => onJump(b.page)}
                  >
                    <Text style={styles.rowIcon}>{b.icon}</Text>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {b.label || "Bookmark"}
                      </Text>
                      <Text style={styles.rowMeta}>Page {b.page}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onRemoveBookmark(b.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              Highlights
            </Text>
            {sortedHighlights.length === 0 ? (
              <Text style={styles.empty}>
                Select text on a page to highlight it.
              </Text>
            ) : (
              sortedHighlights.map((h) => (
                <View key={h.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.rowMain}
                    onPress={() => onJump(h.page)}
                  >
                    <View
                      style={[styles.highlightDot, { backgroundColor: h.color }]}
                    />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {h.text || "Highlight"}
                      </Text>
                      <Text style={styles.rowMeta}>Page {h.page}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onRemoveHighlight(h.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
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
  sheet: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: palette.darkSurface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.darkBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.darkBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.textOnDark,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textOnDarkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    fontSize: 14,
    color: palette.textOnDarkMuted,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.darkBorder,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  rowIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  highlightDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: palette.textOnDark,
  },
  rowMeta: {
    fontSize: 13,
    color: palette.textOnDarkMuted,
    marginTop: 2,
  },
});