import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Book } from "../types";
import { palette, radius, spacing } from "../constants/theme";
import { BookCover, progressOf } from "./BookCover";

interface Props {
  book: Book | null;
  onClose: () => void;
  onRename: (id: string, title: string) => void;
  onToggleFinished: (book: Book) => void;
  onRemove: (id: string) => void;
}

/** Bottom sheet with per-book actions: rename, mark finished, remove. */
export function BookActionsSheet({
  book,
  onClose,
  onRename,
  onToggleFinished,
  onRemove,
}: Props) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (book) setTitle(book.title);
  }, [book]);

  if (!book) return null;

  const saveTitle = () => {
    const next = title.trim();
    if (next && next !== book.title) onRename(book.id, next);
  };

  const confirmRemove = () => {
    Alert.alert("Remove book", `Remove "${book.title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          onRemove(book.id);
          onClose();
        },
      },
    ]);
  };

  const pct = Math.round(progressOf(book) * 100);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            saveTitle();
            onClose();
          }}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <BookCover book={book} width={56} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onSubmitEditing={saveTitle}
                  onBlur={saveTitle}
                  style={styles.input}
                  returnKeyType="done"
                  selectTextOnFocus
                />
                <Text style={styles.meta}>
                  {book.totalPages
                    ? `${book.totalPages} pages · ${pct}% read`
                    : "Not opened yet"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.action}
              onPress={() => {
                saveTitle();
                onToggleFinished(book);
                onClose();
              }}
            >
              <Ionicons
                name={book.finishedAt ? "refresh" : "checkmark-done"}
                size={20}
                color={palette.primary}
              />
              <Text style={styles.actionText}>
                {book.finishedAt ? "Mark as not finished" : "Mark as finished"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={confirmRemove}>
              <Ionicons name="trash-outline" size={20} color={palette.danger} />
              <Text style={[styles.actionText, { color: palette.danger }]}>
                Remove from library
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.lightCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.lightBorder,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.textSecondary,
    marginBottom: 4,
  },
  input: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.textPrimary,
    borderWidth: 1,
    borderColor: palette.lightBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.lightBackground,
  },
  meta: { fontSize: 12, color: palette.textSecondary, marginTop: 6 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.lightBorder,
  },
  actionText: { fontSize: 16, fontWeight: "600", color: palette.textPrimary },
});
