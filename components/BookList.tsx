import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import useBookStore from "../store/bookStore";
import useStatsStore from "../store/statsStore";
import { Book } from "../types";
import PDFViewer from "./PDF/PDFViewer";
import { useBookActions } from "../hooks/useBookActions";
import type { AppColors } from "../constants/theme";
import { radius, spacing } from "../constants/theme";
import { useAppColors, useThemedStyles } from "../hooks/useAppTheme";
import { CONTENT_MAX_WIDTH, useBreakpoint } from "../hooks/useBreakpoint";
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
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import {
  focusNode,
  isActivationKey,
  keyFromEvent,
  nextGridIndex,
} from "../utils/keyboard";

/** Keys that move the library selection (see `utils/keyboard.ts`). */
const GRID_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "h",
  "j",
  "k",
  "l",
  "Home",
  "End",
];

type Filter = "all" | "reading" | "unread" | "finished";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reading", label: "Reading" },
  { id: "unread", label: "Unread" },
  { id: "finished", label: "Finished" },
];

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
  const c = useAppColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { width, columns, isDesktop } = useBreakpoint();
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
  // Keyboard selection: the tile arrow keys act on, and the DOM nodes to focus.
  // -1 means nothing is selected yet, so the first arrow key lands on tile 0.
  const [focusIndex, setFocusIndex] = useState(-1);
  const tileRefs = useRef<Array<unknown>>([]);
  // Tabs stay mounted after their first visit, so the library's global keys
  // must only listen while this tab is the visible one.
  const [tabFocused, setTabFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      return () => setTabFocused(false);
    }, []),
  );
  // Only draw the selection ring once the keyboard is in use, so mouse clicks
  // don't leave a ring behind.
  const [keyboardMode, setKeyboardMode] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" || GRID_KEYS.includes(event.key)) {
        setKeyboardMode(true);
      }
    };
    const onPointerDown = () => setKeyboardMode(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

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
    const cnt: Record<Filter, number> = {
      all: books.length,
      reading: 0,
      unread: 0,
      finished: 0,
    };
    for (const b of books) {
      if (matchesFilter(b, "reading")) cnt.reading++;
      else if (matchesFilter(b, "unread")) cnt.unread++;
      else if (matchesFilter(b, "finished")) cnt.finished++;
    }
    return cnt;
  }, [books]);

  const tileWidth = Math.floor(
    (Math.min(width, CONTENT_MAX_WIDTH) -
      spacing.lg * 2 -
      GAP * (columns - 1)) /
      columns,
  );

  const openBook = useCallback((book: Book) => {
    beforeRef.current = snapshot(useStatsStore.getState().days);
    haptics.tap();
    setReadingId(book.id);
  }, []);

  const focusTile = useCallback((index: number) => {
    const node = tileRefs.current[index];
    if (focusNode(node)) return;
    // Native: hand focus to the accessibility tree so a hardware keyboard
    // lands on the tile (RN views have no imperative focus()).
    const handle = findNodeHandle(node as never);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  /** Moves the selection with `key`; returns false when it wasn't a grid key. */
  const moveFocus = useCallback(
    (key: string) => {
      if (visible.length === 0) return false;
      // Nothing focused yet: the first arrow key selects the first book.
      if (focusIndex < 0) {
        if (nextGridIndex(0, key, columns, visible.length) === null) {
          return false;
        }
        setFocusIndex(0);
        focusTile(0);
        return true;
      }
      const next = nextGridIndex(focusIndex, key, columns, visible.length);
      if (next === null) return false;
      setFocusIndex(next);
      focusTile(next);
      return true;
    },
    [focusIndex, columns, visible.length, focusTile],
  );

  // Keep the selection inside the list when the filter changes the count.
  useEffect(() => {
    setFocusIndex((i) => (i < 0 ? i : Math.min(i, visible.length - 1)));
  }, [visible.length]);

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

  // Library-wide keys. Enter/Space on a focused tile is handled by the tile
  // itself (react-native-web presses it), so only movement lives here.
  useKeyboardShortcuts(
    [
      {
        keys: GRID_KEYS,
        handler: (e) => {
          if (moveFocus(e.key)) e.preventDefault();
        },
      },
      { keys: ["a"], handler: () => void addBooks() },
    ],
    tabFocused && !readingId && !actionsBook,
  );

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
          accessibilityRole="button"
          accessibilityLabel={`Reading streak: ${streak.current} days. Open stats`}
          focusable
        >
          <Text style={styles.streakText}>
            {streak.current > 0 ? "🔥" : "🌱"} {streak.current}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAddButton}
          onPress={addBooks}
          accessibilityRole="button"
          accessibilityLabel="Add books"
          focusable
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {continueBook && filter === "all" ? (
        <TouchableOpacity
          style={styles.hero}
          activeOpacity={0.9}
          onPress={() => openBook(continueBook)}
          accessibilityRole="button"
          accessibilityLabel={`Continue reading ${continueBook.title}`}
          focusable
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
                <Ionicons name="play" size={14} color={c.primary} />
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
                accessibilityRole="button"
                accessibilityLabel={`${f.label} filter`}
                accessibilityState={{ selected: active }}
                focusable
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

      {isDesktop && books.length > 0 ? (
        <Text style={styles.keyboardHint}>
          ← → ↑ ↓ move · Enter open · Tab next · A add book
        </Text>
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
              <Ionicons name="library-outline" size={44} color={c.primary} />
            </View>
            <Text style={styles.emptyTitle}>Start your collection</Text>
            <Text style={styles.emptyText}>
              Import PDFs and build a reading streak. Covers, progress and stats
              appear automatically.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={addBooks}
              accessibilityRole="button"
              accessibilityLabel="Add your first book"
              focusable
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Add your first book</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={visible}
          key={`grid-${columns}`}
          numColumns={columns}
          keyExtractor={(b) => b.id}
          ListHeaderComponent={header}
          contentContainerStyle={[
            styles.listContent,
            isDesktop && styles.listContentDesktop,
          ]}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: spacing.lg }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.filterEmpty}>
              {filter === "finished"
                ? "No finished books yet — you've got this! 💪"
                : "Nothing here yet."}
            </Text>
          }
          renderItem={({ item, index }) => (
            // The "…" button must not sit inside the tile's Pressable: on web
            // both render as <button>, and a <button> inside a <button> is
            // invalid HTML (React reports it as a hydration error).
            <View
              style={[
                { width: tileWidth, marginBottom: spacing.lg },
                keyboardMode && index === focusIndex && styles.tileFocused,
              ]}
            >
              <Pressable
                ref={(node) => {
                  tileRefs.current[index] = node;
                }}
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                onPress={() => openBook(item)}
                onLongPress={() => {
                  haptics.tap();
                  setActionsBook(item);
                }}
                onFocus={() => setFocusIndex(index)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${statusLine(item)}`}
                accessibilityHint="Opens the reader"
                tabIndex={0}
                focusable
                onKeyDown={
                  // Web keys are handled by the document listener above (and by
                  // Pressable for Enter/Space); native hardware keyboards need
                  // this explicit handler.
                  Platform.OS === "web"
                    ? undefined
                    : (event) => {
                        const key = keyFromEvent(event);
                        if (isActivationKey(key)) {
                          openBook(item);
                          return;
                        }
                        moveFocus(key);
                      }
                }
              >
                <BookCover book={item} width={tileWidth} />
                <Text style={styles.tileTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
              <View style={styles.tileFooter}>
                <Text
                  style={[
                    styles.tileStatus,
                    item.finishedAt && { color: c.success },
                  ]}
                  onPress={() => openBook(item)}
                  accessible={false}
                >
                  {statusLine(item)}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setActionsBook(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${item.title}`}
                  focusable
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={16}
                    color={c.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {!item.finishedAt && item.currentPage > 1 ? (
                <ProgressBar value={progressOf(item)} height={3} />
              ) : null}
            </View>
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

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
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
      color: c.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    streakChip: {
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: c.streakBg,
      borderWidth: 1,
      borderColor: c.streakBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    streakChipAtRisk: {
      backgroundColor: c.streakRiskBg,
      borderColor: c.streakRiskBorder,
    },
    streakText: { fontSize: 15, fontWeight: "800", color: c.streakText },
    headerAddButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
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
      backgroundColor: c.primary,
      shadowColor: c.primary,
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
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.inverse,
      borderColor: c.inverse,
    },
    chipText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
    chipTextActive: { color: c.onInverse },
    listContent: { paddingBottom: spacing.xl * 3 },
    listContentDesktop: {
      maxWidth: CONTENT_MAX_WIDTH,
      width: "100%",
      alignSelf: "center",
    },
    tileTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.text,
      marginTop: 8,
      lineHeight: 17,
    },
    tileFocused: {
      borderRadius: radius.md,
      outlineWidth: 2,
      outlineStyle: "solid",
      outlineColor: c.primary,
      outlineOffset: 3,
    },
    tileFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 3,
      marginBottom: 5,
    },
    tileStatus: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },
    filterEmpty: {
      textAlign: "center",
      color: c.textSecondary,
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    keyboardHint: {
      fontSize: 12,
      color: c.textMuted,
      paddingHorizontal: spacing.lg,
      marginTop: -spacing.xs,
      marginBottom: spacing.md,
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
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: c.text,
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
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
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 5,
    },
    emptyButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  });
