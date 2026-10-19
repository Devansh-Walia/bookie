import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import useBookStore from "../store/bookStore";
import { Book } from "../types";
import PDFViewer from "./PDF/PDFViewer";
import { useBookActions } from "../hooks/useBookActions";
import { palette, radius, spacing } from "../constants/theme";

// A small set of accent hues used to give each book a distinct, colorful
// thumbnail so the library feels lively without any image assets.
const BOOK_ACCENTS = [
  "#6366F1",
  "#8B5CF6",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#F43F5E",
];

function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return BOOK_ACCENTS[Math.abs(hash) % BOOK_ACCENTS.length];
}

function formatLastRead(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function BookCard({
  book,
  onSelect,
  onRemove,
}: {
  book: Book;
  onSelect: (book: Book) => void;
  onRemove: (id: string) => void;
}) {
  const accent = accentForId(book.id);
  const title = book.title.replace(/\.pdf$/i, "");

  const confirmRemove = () => {
    Alert.alert("Remove book", `Remove "${title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => onRemove(book.id) },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onSelect(book)}
    >
      <View style={[styles.thumb, { backgroundColor: accent }]}>
        <Ionicons name="book" size={26} color="#fff" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.cardMeta}>
          {book.currentPage > 1
            ? `Page ${book.currentPage}`
            : "Not started yet"}
        </Text>
        <Text style={styles.cardDate}>Last read {formatLastRead(book.lastReadAt)}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={confirmRemove}
      >
        <Ionicons name="trash-outline" size={20} color={palette.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function BookList() {
  const { books, removeBook } = useBookStore();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const { handleAddBook } = useBookActions();

  const sortedBooks = useMemo(
    () =>
      [...books].sort(
        (a, b) =>
          new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime()
      ),
    [books]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {selectedBook && (
        <Modal
          animationType="slide"
          visible={!!selectedBook}
          onRequestClose={() => setSelectedBook(null)}
        >
          <PDFViewer
            bookId={selectedBook.id}
            fileUri={selectedBook.fileUri}
            currentPage={selectedBook.currentPage}
            onClose={() => setSelectedBook(null)}
          />
        </Modal>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Library</Text>
          <Text style={styles.headerSubtitle}>
            {books.length === 0
              ? "No books yet"
              : `${books.length} ${books.length === 1 ? "book" : "books"}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerAddButton} onPress={handleAddBook}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {sortedBooks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="library-outline" size={44} color={palette.primary} />
          </View>
          <Text style={styles.emptyTitle}>Start your collection</Text>
          <Text style={styles.emptyText}>
            Import a PDF and it will show up here, ready to read with a tap.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleAddBook}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.emptyButtonText}>Add your first book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onSelect={setSelectedBook}
              onRemove={removeBook}
            />
          ))}
          <TouchableOpacity style={styles.addButton} onPress={handleAddBook}>
            <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
            <Text style={styles.addButtonText}>Add another book</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.lightBackground,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: palette.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    marginTop: 2,
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.lightCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: palette.lightBorder,
  },
  thumb: {
    width: 52,
    height: 64,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: palette.textPrimary,
  },
  cardMeta: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 3,
  },
  cardDate: {
    fontSize: 12,
    color: palette.textSecondary,
    opacity: 0.8,
    marginTop: 2,
  },
  removeButton: {
    padding: spacing.sm,
    borderRadius: radius.pill,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: palette.primary,
    backgroundColor: palette.accentSoft,
  },
  addButtonText: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: palette.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});