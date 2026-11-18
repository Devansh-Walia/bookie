import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { hasCommandModifier, isEditableTarget } from "../utils/keyboard";

export interface KeyboardShortcut {
  /** One key, or several that do the same thing (`"ArrowRight"`, `"l"`). */
  keys: string | string[];
  handler: (event: KeyboardEvent) => void;
  /** Also fire while a text field has focus. Default: false. */
  allowInInput?: boolean;
  /** Require Shift (`true`) or forbid it (`false`). Default: either. */
  shift?: boolean;
}

/**
 * Document-level keyboard shortcuts for the web build.
 *
 * Native builds get their keys from `onKeyDown` on focusable views, so this is
 * a no-op there. The shortcut list is kept in a ref so handlers can close over
 * fresh state without re-binding the listener on every render.
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  enabled = true,
): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled || Platform.OS !== "web") return;
    if (typeof window === "undefined") return;

    function onKeyDown(event: KeyboardEvent) {
      // Another handler (a focused Pressable, a modal) already dealt with it.
      if (event.defaultPrevented || hasCommandModifier(event)) return;

      for (const shortcut of shortcutsRef.current) {
        const keys = Array.isArray(shortcut.keys)
          ? shortcut.keys
          : [shortcut.keys];
        if (!keys.includes(event.key)) continue;
        if (shortcut.shift !== undefined && shortcut.shift !== event.shiftKey) {
          continue;
        }
        if (!shortcut.allowInInput && isEditableTarget(event.target)) return;
        shortcut.handler(event);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
