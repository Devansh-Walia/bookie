import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import useBookStore from "../store/bookStore";
import useStatsStore from "../store/statsStore";
import { Book } from "../types";
import PDFViewer from "./PDF/PDFViewer";
import { useBookActions } from "../hooks/useBookActions";
import { palette, radius, spacing } from "../constants/theme";
import { BookCover, ProgressBar, progressOf } from "./BookCover";
import { BookActionsSheet } from "./BookActionsSheet";
import { SessionToast, ToastMessage } from "./SessionToast";
import { Celebration } from "./Celebration";
import {
  computeStreaks,
  sessionMessage,
  snapshot,
  ProgressSnapshot,
} from "../utils/stats";
import { haptics } from "../utils/haptics";

type Filter = "all" | "reading" | "unread" | "finished";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "unread", label: "Unread" },
  { id: "finished", label: "Finished" },
];

const COLUMNS = 3;
const GAP = 14;

function matchesFilter(book: Book, filter: Filter) {
  switch (filter) {
    case "reading":
      return !book.finishedAt && book.currentPage > 1;
    case "unread":
      return !book.finishedAt && book.currentPage <= 1;
    case "finished":
      return !!book.finishedAt;
    default:
      return true;
  }
}

function statusLine(book: Book): string {
  if (book.finishedAt) return "Finished";
  if (book.currentPage <= 1) return "New";
  if (!book.totalPages) return `Page ${book.currentPage}`;
  return `${Math.round(progressOf(book) * 100)}%`;
}

export default function BookList() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const books = useBookStore((s) => s.books);
  const removeBook = useBookStore((s) => s.removeBook);
  const renameBook = useBookStore((s) => s.renameBook);
  const setFinished = useBookStore((s) => s.setFinished);
  const days = useStatsStore((s) => s.days);
  const dailyGoal = useStatsStore((s) => s.dailyGoal);
  const finishedCount = useStatsStore((s) => s.finished.length);
  const recordFinished = useStatsStore((s) => s.recordFinished);
  const unrecordFinished = useStatsStore((s) => s.unrecordFinished);
  const { handleAddBook } = useBookActions();

  const [readingId, setReadingId] = useState<string | null>(null);
  const [actionsBook, setActionsBook] = useState<Book | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [celebrate, setCelebrate] = useState<Book | null>(null);
  const beforeRef = useRef<ProgressSnapshot | null>(null);

  const streak = useMemo(() => computeStreaks(days), [days]);
  const todayPages = snapshot(days).today.pages;

  const sorted = useMemo(
    () => [...books].sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt)),
    [books],
  );
  const continueBook = useMemo(
    () => sorted.find((b) => !b.finishedAt && b.currentPage > 1) ?? null,
    [sorted],
  );
  const visible = useMemo(
    () => sorted.filter((b) => matchesFilter(b, filter)),
    [sorted, filter],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: books.length,
      reading: 0,
      unread: 0,
      finished: 0,
    };
    for (const b of books) {
      if (matchesFilter(b, "reading")) c.reading++;
      else if (matchesFilter(b, "unread")) c.unread++;
      else if (matchesFilter(b, "finished")) c.finished++;
    }
    return c;
  }, [books]);

  const tileWidth = Math.floor(
    (width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS,
  );

  const openBook = useCallback((book: Book) => {
    beforeRef.current = snapshot(useStatsStore.getState().days);
    haptics.tap();
    setReadingId(book.id);
  }, []);

  const closeReader = useCallback(() => {
    setReadingId(null);
    // Let the reader unmount (which flushes the session) before diffing stats.
    setTimeout(() => {
      const before = beforeRef.current;
      beforeRef.current = null;
      if (!before) return;
      const state = useStatsStore.getState();
      const msg = sessionMessage(before, snapshot(state.days), state.dailyGoal);
      if (msg) setToast({ id: Date.now(), ...msg });
    }, 120);
  }, []);

  const toggleFinished = useCallback(
    (book: Book) => {
      if (book.finishedAt) {
        setFinished(book.id, false);
        unrecordFinished(book.id);
      } else {
        setFinished(book.id, true);
        recordFinished(book.id, book.title);
        haptics.success();
        setCelebrate(book);
      }
    },
    [setFinished, recordFinished, unrecordFinished],
  );

  const addBooks = useCallback(async () => {
    const ids = await handleAddBook();
    if (ids.length) {
      haptics.success();
      setFilter("all");
      setToast({
        id: Date.now(),
        title:
          ids.length === 1 ? "📚 Book added" : `📚 ${ids.length} books added`,
        subtitle: "Generating covers…",
      });
    }
  }, [handleAddBook]);

  const header = (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <Text style={styles.headerSubtitle}>
            {books.length === 0
              ? "No books yet"
              : `${books.length} ${books.length === 1 ? "book" : "books"} · ${finishedCount} finished`}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.streakChip,
            !streak.readToday && streak.current > 0 && styles.streakChipAtRisk,
          ]}
          onPress={() => router.push("/stats")}
          activeOpacity={0.8}
        >
          <Text style={styles.streakText}>
            {streak.current > 0 ? "🔥" : "🌱"} {streak.current}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerAddButton} onPress={addBooks}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {continueBook && filter === "all" ? (
        <TouchableOpacity
          style={styles.hero}
          activeOpacity={0.9}
          onPress={() => openBook(continueBook)}
        >
          <BookCover book={continueBook} width={78} />
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>CONTINUE READING</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {continueBook.title}
            </Text>
            <Text style={styles.heroMeta}>
              {continueBook.totalPages
                ? `Page ${continueBook.currentPage} of ${continueBook.totalPages} · ${Math.round(
                    progressOf(continueBook) * 100,
                  )}%`
                : `Page ${continueBook.currentPage}`}
            </Text>
            <ProgressBar
              value={progressOf(continueBook)}
              color="#fff"
              height={5}
            />
            <View style={styles.heroGoal}>
              <Text style={styles.heroGoalText}>
                {todayPages >= dailyGoal
                  ? "🎯 Goal done today!"
                  : `Today ${todayPages}/${dailyGoal} pages`}
              </Text>
              <View style={styles.heroPlay}>
                <Ionicons name="play" size={14} color={palette.primary} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {books.length > 0 ? (
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  haptics.tap();
                  setFilter(f.id);
                }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {f.label} {counts[f.id] > 0 ? counts[f.id] : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <Modal
        animationType="slide"
        visible={!!readingId}
        onRequestClose={closeReader}
      >
        {readingId ? (
          <PDFViewer bookId={readingId} onClose={closeReader} />
        ) : null}
      </Modal>

      {books.length === 0 ? (
        <>
          {header}
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="library-outline"
                size={44}
                color={palette.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Start your collection</Text>
            <Text style={styles.emptyText}>
              Import PDFs and build a reading streak. Covers, progress and stats
              appear automatically.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={addBooks}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Add your first book</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={visible}
          key={`grid-${COLUMNS}`}
          numColumns={COLUMNS}
          keyExtractor={(b) => b.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: spacing.lg }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.filterEmpty}>
              {filter === "finished"
                ? "No finished books yet — you've got this! 💪"
                : "Nothing here yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                { width: tileWidth, marginBottom: spacing.lg },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => openBook(item)}
              onLongPress={() => {
                haptics.tap();
                setActionsBook(item);
              }}
            >
              <BookCover book={item} width={tileWidth} />
              <Text style={styles.tileTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.tileFooter}>
                <Text
                  style={[
                    styles.tileStatus,
                    item.finishedAt && { color: palette.success },
                  ]}
                >
                  {statusLine(item)}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setActionsBook(item)}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={16}
                    color={palette.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {!item.finishedAt && item.currentPage > 1 ? (
                <ProgressBar value={progressOf(item)} height={3} />
              ) : null}
            </Pressable>
          )}
        />
      )}

      <BookActionsSheet
        book={actionsBook}
        onClose={() => setActionsBook(null)}
        onRename={renameBook}
        onToggleFinished={toggleFinished}
        onRemove={removeBook}
      />

      <Celebration
        visible={!!celebrate}
        title={celebrate?.title ?? ""}
        totalPages={celebrate?.totalPages ?? 0}
        booksFinished={finishedCount}
        onClose={() => setCelebrate(null)}
      />

      <SessionToast message={toast} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.lightBackground },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  headerSubtitle: { fontSize: 14, color: palette.textSecondary, marginTop: 2 },
  streakChip: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#FFF4E5",
    borderWidth: 1,
    borderColor: "#FED7AA",
    alignItems: "center",
    justifyContent: "center",
  },
  streakChipAtRisk: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  streakText: { fontSize: 15, fontWeight: "800", color: "#C2410C" },
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
  hero: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  heroBody: { flex: 1, marginLeft: spacing.md, justifyContent: "center" },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 2 },
  heroMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    marginBottom: 8,
  },
  heroGoal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  heroGoalText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  heroPlay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.lightCard,
    borderWidth: 1,
    borderColor: palette.lightBorder,
  },
  chipActive: {
    backgroundColor: palette.textPrimary,
    borderColor: palette.textPrimary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: palette.textSecondary },
  chipTextActive: { color: "#fff" },
  listContent: { paddingBottom: spacing.xl * 3 },
  tileTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.textPrimary,
    marginTop: 8,
    lineHeight: 17,
  },
  tileFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
    marginBottom: 5,
  },
  tileStatus: { fontSize: 12, color: palette.textSecondary, fontWeight: "600" },
  filterEmpty: {
    textAlign: "center",
    color: palette.textSecondary,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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
    maxWidth: 300,
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
  emptyButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
