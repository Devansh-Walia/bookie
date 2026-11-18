/**
 * Keyboard navigation helpers shared by the library, the reader and the
 * modals.
 *
 * Everything here is pure so the key mapping can be unit-tested without a DOM
 * or a React Native runtime — the hooks and components only wire it up.
 */

/** Where a key wants the selection to go inside a grid. */
export type GridIntent = "left" | "right" | "up" | "down" | "first" | "last";

/** Where a key wants the reader to go. */
export type PageIntent = "next" | "prev" | "first" | "last";

const LEFT_KEYS = ["ArrowLeft", "h"];
const RIGHT_KEYS = ["ArrowRight", "l"];
const UP_KEYS = ["ArrowUp", "k"];
const DOWN_KEYS = ["ArrowDown", "j"];

/** Maps a key to a grid movement, or `null` when it isn't one. */
export function gridIntent(key: string): GridIntent | null {
  if (LEFT_KEYS.includes(key)) return "left";
  if (RIGHT_KEYS.includes(key)) return "right";
  if (UP_KEYS.includes(key)) return "up";
  if (DOWN_KEYS.includes(key)) return "down";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

/**
 * The next selection index for a grid, clamped to `[0, count - 1]`.
 *
 * Returns `null` when the key isn't a grid key or the grid is empty, so callers
 * know whether to `preventDefault()`.
 */
export function nextGridIndex(
  current: number,
  key: string,
  columns: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  const intent = gridIntent(key);
  if (!intent) return null;

  const cols = Math.max(1, columns);
  const last = count - 1;
  const from = current < 0 ? 0 : Math.min(current, last);

  switch (intent) {
    case "left":
      return Math.max(0, from - 1);
    case "right":
      return Math.min(last, from + 1);
    case "up":
      return Math.max(0, from - cols);
    case "down":
      return Math.min(last, from + cols);
    case "first":
      return 0;
    case "last":
      return last;
  }
}

/**
 * Maps a key to a page turn. Space turns forward, Shift+Space back — the
 * convention every PDF reader uses.
 */
export function pageIntent(key: string, shiftKey = false): PageIntent | null {
  if (key === " " || key === "Spacebar") return shiftKey ? "prev" : "next";
  if (
    key === "ArrowRight" ||
    key === "ArrowDown" ||
    key === "PageDown" ||
    key === "j" ||
    key === "l"
  ) {
    return "next";
  }
  if (
    key === "ArrowLeft" ||
    key === "ArrowUp" ||
    key === "PageUp" ||
    key === "k" ||
    key === "h"
  ) {
    return "prev";
  }
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

/** Enter/Space activate the focused control. */
export function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}

/** Normalises the key from a DOM event or a React Native `onKeyDown` event. */
export function keyFromEvent(event: unknown): string {
  if (!event || typeof event !== "object") return "";
  const e = event as { key?: unknown; nativeEvent?: { key?: unknown } };
  if (typeof e.key === "string") return e.key;
  if (e.nativeEvent && typeof e.nativeEvent.key === "string") {
    return e.nativeEvent.key;
  }
  return "";
}

/**
 * True when a key event is aimed at a text field, where shortcuts must stay
 * out of the way so typing still works.
 */
export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    getAttribute?: (name: string) => string | null;
  };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (
    typeof el.getAttribute === "function" &&
    el.getAttribute("role") === "textbox"
  ) {
    return true;
  }
  return false;
}

/**
 * True when the event is aimed at something that already reacts to Enter and
 * Space (a button, link or switch). Those keys must be left alone so the
 * focused control still activates.
 */
export function isControlTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: unknown;
    getAttribute?: (name: string) => string | null;
  };
  const tag = typeof el.tagName === "string" ? el.tagName.toUpperCase() : "";
  if (tag === "BUTTON" || tag === "A" || tag === "INPUT") return true;
  if (typeof el.getAttribute === "function") {
    const role = el.getAttribute("role");
    return (
      role === "button" ||
      role === "link" ||
      role === "switch" ||
      role === "checkbox" ||
      role === "radio"
    );
  }
  return false;
}

/** True for the modifier combos we leave to the browser/OS. */
export function hasCommandModifier(event: unknown): boolean {
  if (!event || typeof event !== "object") return false;
  const e = event as {
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
  };
  return e.metaKey === true || e.ctrlKey === true || e.altKey === true;
}

/**
 * Moves DOM focus to a host node when the platform supports it. On web the
 * ref of a `View`/`Pressable` *is* the DOM element, so this is all we need.
 */
export function focusNode(node: unknown): boolean {
  const candidate = node as { focus?: () => void } | null;
  if (candidate && typeof candidate.focus === "function") {
    candidate.focus();
    return true;
  }
  return false;
}
